import { randomUUID } from "node:crypto";
import { InMemoryBookingAttemptLedger, type BookingAttemptLedger } from "./attempt-ledger";
import { bookingReceiptToPublic, recordToBookingReceipt, toBookLoadFields } from "./booking";
import { bookingWriteDisposition, classifyBookingOutcome } from "./booking-outcome";
import { isTmsAdapterError, TmsConfigurationError, TmsUpstreamError, TmsValidationError } from "./errors";
import { parseLoadQueryInput, recordToPublicLoad, toLoadDetailFields, toLoadQueryFields } from "./loads";
import type { TmsCommandPolicy } from "./policy";
import { noReconciliationAuthority, type AuthoritativeReconciliationClassifier, type ReconciliationOutcome as AuthoritativeReconciliationOutcome } from "./real/reconciliation";
import { buildRequest } from "./protocol";
import { DEADLINE_PHASES, DeadlineBudget } from "./deadline";
import type { BookLoadInput, LoadPublic, LoadQueryInput, TmsCommandRequest, TmsConfig, TmsParsedResponse } from "./types";

export const CONTROLLED_BOOKING_TTL_MS = 30_000;
export const MAX_COUNTEROFFERS = 3;
export const FMCSA_VALIDATION_MAX_AGE_MS = 5 * 60_000;

export type ControlledBookingState = "ready" | "queried" | "selected" | "detailed" | "handoffs-validated" | "booking-consumed" | "uncertain" | "terminal";
export type ReconciliationOutcome = AuthoritativeReconciliationOutcome;

export interface LoadOperationResult {
  response: TmsParsedResponse;
  requestBytes: number;
  durationMs: number;
}

export interface QueryRun {
  readonly runId: string;
  readonly sessionId: string;
  readonly query: LoadQueryInput;
  readonly candidates: readonly LoadPublic[];
  readonly queriedAt: number;
  readonly expiresAt: number;
}

export interface SelectedLoad {
  readonly queryRun: QueryRun;
  readonly load: LoadPublic;
  readonly selectedLoadId: string;
  readonly explicitSelectionConfirmed: true;
}

export interface NegotiationHandoffInput {
  loadId: string;
  runId: string;
  sessionId: string;
  agreedRate: number | string;
  finalAccepted: boolean;
  counterofferCount: number;
}

export interface NegotiationHandoff {
  readonly loadId: string;
  readonly runId: string;
  readonly sessionId: string;
  readonly agreedRate: number;
  readonly finalAccepted: true;
  readonly counterofferCount: number;
  readonly [TEST_HANDOFF]: true;
}

export interface CarrierValidationHandoffInput {
  loadId: string;
  runId: string;
  sessionId: string;
  mcNumber: string;
  validated: boolean;
  validatedAt: number;
  validationReference?: string;
}

export interface CarrierValidationHandoff {
  readonly loadId: string;
  readonly runId: string;
  readonly sessionId: string;
  readonly mcNumber: string;
  readonly validated: true;
  readonly validatedAt: number;
  readonly validationReference?: string;
  readonly [TEST_HANDOFF]: true;
}

const TEST_HANDOFF = Symbol("test-only-booking-handoff");
export interface BookingAuthorizationContext {
  readonly selection: SelectedLoad;
  readonly detail: LoadPublic;
  readonly negotiation: NegotiationHandoff;
  readonly carrier: CarrierValidationHandoff;
  readonly expiresAt: number;
}

export interface ControlledBookingOperationResult {
  readonly operation: "LOAD_QUERY" | "LOAD_GET" | "LOAD_BOOK";
  readonly result: LoadOperationResult;
}

const AUTHORIZATION_CREATION_TOKEN = Symbol("controlled-booking-authorization");
const AUTHORIZATION_INSTANCES = new WeakSet<object>();

export interface ControlledBookingPort {
  execute(request: TmsCommandRequest): Promise<TmsParsedResponse>;
  executeBooking?(authorization: ControlledBookingAuthorization): Promise<TmsParsedResponse>;
}

export function isPostWriteBookingUncertain(error: unknown): boolean {
  return isTmsAdapterError(error)
    && error.metadata.command === "LOAD_BOOK"
    && error.metadata.writeDisposition !== undefined
    && error.metadata.writeDisposition !== "not-sent"
    && ["TMS_TIMEOUT", "TMS_RESPONSE_INCOMPLETE", "TMS_CONNECTION", "TMS_PROTOCOL"].includes(error.type);
}

function safeBinding(value: unknown, name: string): string {
  if (typeof value !== "string") throw new TmsValidationError(`${name} must be a string.`);
  const normalized = value.trim();
  if (!normalized || normalized.length > 128 || /[|\r\n]/.test(normalized)) {
    throw new TmsValidationError(`${name} must be non-empty, bounded and contain no framing characters.`);
  }
  return normalized;
}

function normalizeAgreedRate(value: unknown): number {
  const rate = typeof value === "string" ? Number(value.trim()) : value;
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0 || rate > 1_000_000_000 || Math.round(rate * 100) !== rate * 100) {
    throw new TmsValidationError("agreedRate must be a positive amount with at most two decimals.");
  }
  return rate;
}

function assertFresh(expiresAt: number, now: number): void {
  if (now >= expiresAt) throw new TmsValidationError("The selected load context has expired.");
}

function assertSameIdentity(expected: string, actual: string, label: string): void {
  if (expected !== actual) throw new TmsValidationError(`${label} does not match the selected load.`);
}

function assertMaterialDetail(selection: SelectedLoad, detail: LoadPublic): void {
  const fields: Array<keyof LoadPublic> = [
    "loadId", "originState", "destinationState", "originCity", "destinationCity", "equipmentType", "rate",
    "pickupDate", "miles", "status",
  ];
  for (const field of fields) {
    if (selection.load[field] !== detail[field]) {
      throw new TmsUpstreamError("The selected load changed before booking.");
    }
  }
}

export function createNegotiationHandoff(input: NegotiationHandoffInput): NegotiationHandoff {
  const loadId = safeBinding(input.loadId, "negotiation.loadId");
  const runId = safeBinding(input.runId, "negotiation.runId");
  const sessionId = safeBinding(input.sessionId, "negotiation.sessionId");
  if (input.finalAccepted !== true) throw new TmsValidationError("Negotiation requires explicit final acceptance.");
  if (!Number.isInteger(input.counterofferCount) || input.counterofferCount < 0 || input.counterofferCount > MAX_COUNTEROFFERS) {
    throw new TmsValidationError(`Negotiation allows no more than ${MAX_COUNTEROFFERS} counteroffers.`);
  }
  return { loadId, runId, sessionId, agreedRate: normalizeAgreedRate(input.agreedRate), finalAccepted: true, counterofferCount: input.counterofferCount, [TEST_HANDOFF]: true };
}

export function createCarrierValidationHandoff(input: CarrierValidationHandoffInput, now = Date.now()): CarrierValidationHandoff {
  const loadId = safeBinding(input.loadId, "carrier.loadId");
  const runId = safeBinding(input.runId, "carrier.runId");
  const sessionId = safeBinding(input.sessionId, "carrier.sessionId");
  const mcNumber = safeBinding(input.mcNumber, "carrier.mcNumber");
  if (input.validated !== true) throw new TmsValidationError("FMCSA validation is required before booking.");
  if (!Number.isFinite(input.validatedAt) || input.validatedAt > now || now - input.validatedAt > FMCSA_VALIDATION_MAX_AGE_MS) {
    throw new TmsValidationError("FMCSA validation proof is stale or invalid.");
  }
  const validationReference = input.validationReference === undefined ? undefined : safeBinding(input.validationReference, "carrier.validationReference");
  return { loadId, runId, sessionId, mcNumber, validated: true, validatedAt: input.validatedAt, ...(validationReference ? { validationReference } : {}), [TEST_HANDOFF]: true };
}

export function selectLoad(queryRun: QueryRun, selectedLoadId: string, explicitSelectionConfirmed: boolean, now = Date.now()): SelectedLoad {
  assertFresh(queryRun.expiresAt, now);
  if (explicitSelectionConfirmed !== true) throw new TmsValidationError("Explicit load selection confirmation is required.");
  const normalizedId = safeBinding(selectedLoadId, "selectedLoadId");
  const matches = queryRun.candidates.filter((candidate) => candidate.loadId === normalizedId);
  if (matches.length !== 1) throw new TmsValidationError("The selected load was not returned by the approved query.");
  return { queryRun, load: matches[0]!, selectedLoadId: normalizedId, explicitSelectionConfirmed: true };
}

export function selectSoleLoadForValidation(queryRun: QueryRun, explicitSelectionConfirmed: boolean, now = Date.now()): SelectedLoad {
  if (queryRun.query.maxResults !== 1 || queryRun.candidates.length !== 1) {
    throw new TmsValidationError("Sole-result selection requires maxResults=1 and exactly one returned candidate.");
  }
  return selectLoad(queryRun, queryRun.candidates[0]!.loadId, explicitSelectionConfirmed, now);
}

export function filterReturnedLoadsByPickupDate(loads: readonly LoadPublic[], predicate: (pickupDate: string) => boolean): LoadPublic[] {
  return loads.filter((load) => load.pickupDate !== undefined && predicate(load.pickupDate));
}

export class ControlledBookingAuthorization {
  private bookingConsumed = false;
  private bookingClaimInFlight = false;
  private bookingUncertain = false;
  private reconciliationConsumed = false;

  constructor(
    readonly context: BookingAuthorizationContext,
    readonly policy: TmsCommandPolicy,
    private readonly ledger: BookingAttemptLedger,
    token: typeof AUTHORIZATION_CREATION_TOKEN,
  ) {
    if (token !== AUTHORIZATION_CREATION_TOKEN) throw new TmsConfigurationError("Controlled booking authorization must be issued by the workflow.");
    AUTHORIZATION_INSTANCES.add(this);
  }

  static isIssued(value: unknown): value is ControlledBookingAuthorization {
    return typeof value === "object" && value !== null && AUTHORIZATION_INSTANCES.has(value);
  }

  async consumeBooking(now = Date.now()): Promise<string> {
    assertFresh(this.context.expiresAt, now);
    if (this.bookingConsumed || this.bookingClaimInFlight) throw new TmsConfigurationError("The controlled booking attempt has already been consumed.");
    this.bookingClaimInFlight = true;
    try {
      const claimToken = await this.ledger.consumeOnce({
        loadId: this.context.selection.selectedLoadId,
        runId: this.context.selection.queryRun.runId,
        sessionId: this.context.selection.queryRun.sessionId,
      });
      this.bookingConsumed = true;
      return claimToken;
    } finally {
      this.bookingClaimInFlight = false;
    }
  }

  consumeReconciliation(): void {
    if (!this.bookingConsumed) throw new TmsConfigurationError("Reconciliation requires a consumed booking attempt.");
    if (!this.bookingUncertain) throw new TmsConfigurationError("Reconciliation requires genuine post-write booking uncertainty.");
    if (this.reconciliationConsumed) throw new TmsConfigurationError("The reconciliation attempt has already been consumed.");
    this.reconciliationConsumed = true;
  }

  markBookingUncertain(): void {
    if (!this.bookingConsumed) throw new TmsConfigurationError("Booking uncertainty requires a consumed booking attempt.");
    this.bookingUncertain = true;
  }

  get bookingAttemptConsumed(): boolean {
    return this.bookingConsumed;
  }

  get reconciliationAttemptConsumed(): boolean {
    return this.reconciliationConsumed;
  }

  get bookingOutcomeUncertain(): boolean {
    return this.bookingUncertain;
  }
}

export class ControlledBookingWorkflow {
  private state: ControlledBookingState = "ready";
  private queryRun?: QueryRun;
  private selection?: SelectedLoad;
  private detailedLoad?: LoadPublic;
  private authorization?: ControlledBookingAuthorization;

  constructor(
    private readonly config: TmsConfig,
    private readonly port: ControlledBookingPort,
    private readonly policy: TmsCommandPolicy,
    private readonly now: () => number = () => Date.now(),
    private readonly ttlMs = CONTROLLED_BOOKING_TTL_MS,
    private readonly ledger: BookingAttemptLedger,
    private readonly budget?: DeadlineBudget,
  ) {
    if (!ledger || (config.mode === "real" && (ledger instanceof InMemoryBookingAttemptLedger || typeof ledger.transition !== "function"))) {
      throw new TmsConfigurationError("A durable booking attempt ledger is required for this workflow.");
    }
  }

  get currentState(): ControlledBookingState {
    return this.state;
  }

  async query(input: LoadQueryInput, runId: string = randomUUID(), sessionId: string = randomUUID()): Promise<{ run: QueryRun; operation: ControlledBookingOperationResult }> {
    if (this.state !== "ready") throw new TmsConfigurationError("The controlled booking workflow can query only once.");
    const approvedQuery = parseLoadQueryInput(input);
    const startedAt = this.now();
    const fields = await this.runBudget(DEADLINE_PHASES.MAPPING, () => toLoadQueryFields(approvedQuery));
    const response = await this.execute({ command: "LOAD_QUERY", fields, requestId: "phase-2c-query" }, DEADLINE_PHASES.MAPPING);
    const candidates = await this.runBudget(DEADLINE_PHASES.MAPPING, () => response.records.map(recordToPublicLoad));
    if (new Set(candidates.map((candidate) => candidate.loadId)).size !== candidates.length) {
      throw new TmsUpstreamError("The query returned duplicate load identities.");
    }
    const queryRun: QueryRun = { runId: safeBinding(runId, "runId"), sessionId: safeBinding(sessionId, "sessionId"), query: approvedQuery, candidates, queriedAt: startedAt, expiresAt: startedAt + this.ttlMs };
    await this.runBudget(DEADLINE_PHASES.MAPPING, () => { this.queryRun = queryRun; });
    this.state = "queried";
    return { run: queryRun, operation: { operation: "LOAD_QUERY", result: { response, requestBytes: requestBytes(this.config, "LOAD_QUERY", fields), durationMs: Math.max(0, this.now() - startedAt) } } };
  }

  select(selectedLoadId: string, explicitSelectionConfirmed: boolean): SelectedLoad {
    if (this.state !== "queried" || !this.queryRun) throw new TmsConfigurationError("Load selection requires a completed query.");
    this.selection = selectLoad(this.queryRun, selectedLoadId, explicitSelectionConfirmed, this.now());
    this.state = "selected";
    return this.selection;
  }

  async detail(): Promise<{ load: LoadPublic; operation: ControlledBookingOperationResult }> {
    if (this.state !== "selected" || !this.selection) throw new TmsConfigurationError("Load detail requires explicit selection.");
    assertFresh(this.selection.queryRun.expiresAt, this.now());
    const startedAt = this.now();
    const fields = await this.runBudget(DEADLINE_PHASES.MAPPING, () => toLoadDetailFields({ loadId: this.selection!.selectedLoadId }));
    const response = await this.execute({ command: "LOAD_GET", fields, requestId: "phase-2c-detail" }, DEADLINE_PHASES.MAPPING);
    if (response.records.length !== 1) throw new TmsUpstreamError("Selected load detail must contain exactly one record.");
    const load = await this.runBudget(DEADLINE_PHASES.MAPPING, () => recordToPublicLoad(response.records[0]!));
    assertSameIdentity(this.selection.selectedLoadId, load.loadId, "Detail load ID");
    assertMaterialDetail(this.selection, load);
    await this.runBudget(DEADLINE_PHASES.MAPPING, () => {
      this.detailedLoad = load;
      this.state = "detailed";
    });
    return { load, operation: { operation: "LOAD_GET", result: { response, requestBytes: requestBytes(this.config, "LOAD_GET", fields), durationMs: Math.max(0, this.now() - startedAt) } } };
  }

  private issueAuthorization(
    negotiation: NegotiationHandoff,
    carrier: CarrierValidationHandoff,
    bookingConfirmed: boolean,
  ): ControlledBookingAuthorization {
    if (negotiation[TEST_HANDOFF] !== true || carrier[TEST_HANDOFF] !== true) throw new TmsConfigurationError("Booking requires verified handoff results.");
    if (this.state !== "detailed" || !this.selection || !this.detailedLoad || !this.queryRun) throw new TmsConfigurationError("Booking handoffs require a completed selected-load detail.");
    assertFresh(this.queryRun.expiresAt, this.now());
    for (const handoff of [negotiation, carrier]) {
      assertSameIdentity(this.selection.selectedLoadId, handoff.loadId, "Handoff load ID");
      assertSameIdentity(this.queryRun.runId, handoff.runId, "Handoff query run ID");
      assertSameIdentity(this.queryRun.sessionId, handoff.sessionId, "Handoff session ID");
    }
    if (carrier.validatedAt > this.now() || this.now() - carrier.validatedAt > FMCSA_VALIDATION_MAX_AGE_MS) {
      throw new TmsValidationError("FMCSA validation proof is stale.");
    }
    if (bookingConfirmed !== true) throw new TmsConfigurationError("Real booking requires explicit 2C confirmation.");
    this.authorization = new ControlledBookingAuthorization({ selection: this.selection, detail: this.detailedLoad, negotiation, carrier, expiresAt: this.queryRun.expiresAt }, this.policy, this.ledger, AUTHORIZATION_CREATION_TOKEN);
    this.state = "handoffs-validated";
    return this.authorization;
  }

  /** Local fixture seam only; it cannot be used to authorize real booking. */
  authorizeTestOnly(negotiation: NegotiationHandoff, carrier: CarrierValidationHandoff, bookingConfirmed: boolean): ControlledBookingAuthorization {
    if (this.config.mode === "real") throw new TmsConfigurationError("Test-only handoffs cannot authorize real booking.");
    return this.issueAuthorization(negotiation, carrier, bookingConfirmed);
  }

  /** Compatibility name for local fixtures; production callers use authorizeVerified. */
  authorize(negotiation: NegotiationHandoff, carrier: CarrierValidationHandoff, bookingConfirmed: boolean): ControlledBookingAuthorization {
    return this.authorizeTestOnly(negotiation, carrier, bookingConfirmed);
  }


  async book(authorization = this.authorization): Promise<{ booking: ReturnType<typeof bookingReceiptToPublic>; operation: ControlledBookingOperationResult }> {
    if (!authorization || !this.selection) throw new TmsConfigurationError("Booking requires validated handoffs.");
    if (!ControlledBookingAuthorization.isIssued(authorization)) throw new TmsConfigurationError("Booking authorization was not issued by the workflow.");
    if (authorization !== this.authorization) throw new TmsConfigurationError("Booking authorization does not belong to this workflow.");
    if (authorization.bookingAttemptConsumed) throw new TmsConfigurationError("The controlled booking attempt has already been consumed.");
    if (this.state !== "handoffs-validated") throw new TmsConfigurationError("Booking requires validated handoffs.");
    if (this.config.mode === "real" && !this.port.executeBooking) {
      throw new TmsConfigurationError("Real booking requires the dedicated controlled booking port.");
    }
    const claimToken = await this.runBudget(DEADLINE_PHASES.WRITE, () => authorization.consumeBooking(this.now()));
    this.state = "booking-consumed";
    const input: BookLoadInput = { loadId: authorization.context.selection.selectedLoadId, mcNumber: authorization.context.carrier.mcNumber, agreedRate: authorization.context.negotiation.agreedRate };
    const fields = await this.runBudget(DEADLINE_PHASES.MAPPING, () => toBookLoadFields(input));
    let responseReceived = false;
    const startedAt = this.now();
    try {
      const response = await this.executeBooking(authorization);
      responseReceived = true;
      this.budget?.checkpoint();
       if (response.records.length !== 1) throw new TmsUpstreamError("Booking response must contain exactly one record.");
       const receipt = await this.runBudget(DEADLINE_PHASES.MAPPING, () => recordToBookingReceipt(response.records[0]!));
       const outcome = classifyBookingOutcome({ expectedLoadId: authorization.context.selection.selectedLoadId, receipt, writeDisposition: "sent" });
       if (outcome !== "confirmed-success") throw new TmsUpstreamError("Booking receipt does not match the selected load.");
       const booking = bookingReceiptToPublic(receipt, input);
      await this.runBudget(DEADLINE_PHASES.MAPPING, () => { this.state = "terminal"; });
      await this.transitionLedger(authorization, claimToken, "sent");
       return { booking, operation: { operation: "LOAD_BOOK", result: { response, requestBytes: requestBytes(this.config, "LOAD_BOOK", fields), durationMs: Math.max(0, this.now() - startedAt) } } };
    } catch (error) {
       const outcome = classifyBookingOutcome({
         expectedLoadId: authorization.context.selection.selectedLoadId,
         error,
         writeDisposition: responseReceived ? "sent" : bookingWriteDisposition(error),
       });
       if (outcome === "unknown") {
         authorization.markBookingUncertain();
        await this.runBudget(DEADLINE_PHASES.RECONCILIATION, () => { this.state = "uncertain"; });
        await this.transitionLedger(authorization, claimToken, "unknown");
       } else if (outcome === "confirmed-rejection") {
         await this.runBudget(DEADLINE_PHASES.MAPPING, () => { this.state = "terminal"; });
         await this.transitionLedger(authorization, claimToken, "sent");
       } else {
        await this.runBudget(DEADLINE_PHASES.MAPPING, () => { this.state = "terminal"; });
      }
      throw error;
    }
  }

  private async execute(request: TmsCommandRequest, phase: typeof DEADLINE_PHASES[keyof typeof DEADLINE_PHASES]): Promise<TmsParsedResponse> {
    return this.budget ? this.budget.runPhase(phase, () => this.port.execute(request)) : this.port.execute(request);
  }

  private async executeBooking(authorization: ControlledBookingAuthorization): Promise<TmsParsedResponse> {
    if (this.port.executeBooking) return this.budget
      ? this.budget.runPhase(DEADLINE_PHASES.WRITE, () => this.port.executeBooking!(authorization))
      : this.port.executeBooking(authorization);
    return this.execute({ command: "LOAD_BOOK", fields: toBookLoadFields({ loadId: authorization.context.selection.selectedLoadId, mcNumber: authorization.context.carrier.mcNumber, agreedRate: authorization.context.negotiation.agreedRate }), requestId: "phase-2c-booking" }, DEADLINE_PHASES.WRITE);
  }

  private async transitionLedger(authorization: ControlledBookingAuthorization, claimToken: string, state: "sent" | "unknown"): Promise<void> {
    await this.runBudget(DEADLINE_PHASES.MAPPING, () => this.ledger.transition(
      { loadId: authorization.context.selection.selectedLoadId, runId: authorization.context.selection.queryRun.runId, sessionId: authorization.context.selection.queryRun.sessionId },
      claimToken,
      state,
    ));
  }

  async reconcile(
    authorization = this.authorization,
    classifier: AuthoritativeReconciliationClassifier | ((load: LoadPublic) => boolean) = noReconciliationAuthority,
  ): Promise<{ load: LoadPublic; outcome: ReconciliationOutcome; operation: ControlledBookingOperationResult }> {
    if (!authorization || authorization !== this.authorization) throw new TmsConfigurationError("Reconciliation authorization does not belong to this workflow.");
    if (this.state !== "uncertain") throw new TmsConfigurationError("Reconciliation requires genuine post-write booking uncertainty.");
    if (typeof classifier === "function") throw new TmsConfigurationError("Reconciliation requires an authoritative classifier.");
    authorization.consumeReconciliation();
    const startedAt = this.now();
    const fields = toLoadDetailFields({ loadId: authorization.context.selection.selectedLoadId });
    try {
      const response = await this.execute({ command: "LOAD_GET", fields, requestId: "phase-2c-reconciliation" }, DEADLINE_PHASES.RECONCILIATION);
      if (response.records.length !== 1) throw new TmsUpstreamError("Reconciliation detail must contain exactly one record.");
      const load = await this.runBudget(DEADLINE_PHASES.RECONCILIATION, () => recordToPublicLoad(response.records[0]!));
      assertSameIdentity(authorization.context.selection.selectedLoadId, load.loadId, "Reconciliation load ID");
       await this.runBudget(DEADLINE_PHASES.RECONCILIATION, () => { this.state = "terminal"; });
      return {
        load,
          outcome: await this.runBudget(DEADLINE_PHASES.RECONCILIATION, () => classifier.classify(load)),
         operation: { operation: "LOAD_GET", result: { response, requestBytes: requestBytes(this.config, "LOAD_GET", fields), durationMs: Math.max(0, this.now() - startedAt) } },
      };
    } catch (error) {
      this.state = "terminal";
      throw error;
    }
  }

  private async runBudget<T>(phase: typeof DEADLINE_PHASES[keyof typeof DEADLINE_PHASES], operation: () => T | Promise<T>): Promise<T> {
    if (!this.budget) return operation();
    return this.budget.runPhase(phase, async () => operation());
  }
}

function requestBytes(config: TmsConfig, command: "LOAD_QUERY" | "LOAD_GET" | "LOAD_BOOK", fields: Record<string, string | number>): number {
  return buildRequest({ command, authToken: config.authToken, fields }, config.maxRequestBytes ?? config.maxFrameBytes).byteLength;
}
