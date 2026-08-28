import { createCarrierValidationHandoff, createNegotiationHandoff, ControlledBookingWorkflow, isPostWriteBookingUncertain, selectSoleLoadForValidation, type CarrierValidationHandoffInput, type ControlledBookingAuthorization, type NegotiationHandoffInput } from "../../../src/tms/controlled-booking";
import { createControlledBookingPort } from "../../../src/tms/client";
import { TMS_EXECUTION_SCOPES, type TmsCommandPolicy } from "../../../src/tms/policy";
import { createServerRealBookingCapability, type RealBookingAuthority } from "../../../src/tms/real/capability";
import { verifyBookingHandoff, type HandoffProofAuthority, type HandoffProofEnvelope } from "../../../src/tms/real/proof";
import type { AuthoritativeReconciliationClassifier } from "../../../src/tms/real/reconciliation";
import type { BookingHandoffClaims } from "../../../src/tms/real/proof";
import { DeadlineBudget } from "../../../src/tms/deadline";
import { DEADLINE_PHASES } from "../../../src/tms/deadline";
import { MAX_TMS_DEADLINE_MS } from "../../../src/tms/limits";
import { isTmsAdapterError, TmsConfigurationError, type TmsAdapterError } from "../../../src/tms/errors";
import { parseLoadQueryInput } from "../../../src/tms/loads";
import type { LoadOperationResult, QueryRun, SelectedLoad } from "../../../src/tms/controlled-booking";
import type { BookingPublic, LoadQueryInput, TmsConfig } from "../../../src/tms/types";
import { connectTcp, createTlsConnector, type TmsConnect } from "../../../src/tms/transport";
import { FileBookingAttemptLedger, InMemoryBookingAttemptLedger, type BookingAttemptLedger } from "../../../src/tms/attempt-ledger";

export interface RealBookingRuntimeInput {
  query: LoadQueryInput;
  runId: string;
  sessionId: string;
  selectedLoadId?: string;
  selectionConfirmed: boolean;
  negotiation?: NegotiationHandoffInput;
  carrier?: CarrierValidationHandoffInput;
  bookingConfirmed: boolean;
}

export interface RealBookingRunResult {
  query: { run: QueryRun; operation: LoadOperationResult };
  selection: SelectedLoad;
  detail: { load: SelectedLoad["load"]; operation: LoadOperationResult };
  authorization: ControlledBookingAuthorization;
  booking: { booking: BookingPublic; operation: LoadOperationResult };
}

export interface RealBookingRunHooks {
  ledger?: BookingAttemptLedger;
  authority?: RealBookingAuthority;
  handoffProvider?: TrustedBookingHandoffProvider;
  deadline?: DeadlineBudget;
  onAuthorization?: (authorization: ControlledBookingAuthorization, workflow: ControlledBookingWorkflow) => void;
}

export interface TrustedBookingHandoffContext {
  readonly loadId: string;
  readonly runId: string;
  readonly sessionId: string;
}

export interface TrustedBookingHandoffProvider {
  readonly authority?: HandoffProofAuthority;
  readonly getBookingProof?: (context: TrustedBookingHandoffContext, signal?: AbortSignal) => Promise<HandoffProofEnvelope> | HandoffProofEnvelope;
  readonly getExpectedBookingClaims?: (context: TrustedBookingHandoffContext, signal?: AbortSignal) => Promise<Pick<BookingHandoffClaims, "mcNumber" | "agreedRate">> | Pick<BookingHandoffClaims, "mcNumber" | "agreedRate">;
  getNegotiation?(context: TrustedBookingHandoffContext): ReturnType<typeof createNegotiationHandoff>;
  getCarrierValidation?(context: TrustedBookingHandoffContext): ReturnType<typeof createCarrierValidationHandoff>;
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Missing required Phase 2C runtime input: ${name}.`);
  return value;
}

function readJson(env: NodeJS.ProcessEnv, name: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(required(env, name));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch {
    throw new Error(`Invalid Phase 2C JSON input: ${name}.`);
  }
}

export function readRealBookingRuntimeInput(env: NodeJS.ProcessEnv = process.env): RealBookingRuntimeInput {
  const isRealMode = env.TMS_MODE === "real" && env.TMS_ENV === "non-production" && env.TMS_REAL_ENABLED === "true";
  if (isRealMode && (env.TMS_REAL_BOOK_NEGOTIATION_JSON !== undefined || env.TMS_REAL_BOOK_CARRIER_VALIDATION_JSON !== undefined)) {
    throw new TmsConfigurationError("Real booking handoffs must come from the trusted provider, not runtime JSON.");
  }
  const query = parseLoadQueryInput(readJson(env, "TMS_REAL_BOOK_QUERY_JSON"));
  const negotiation = env.TMS_REAL_BOOK_NEGOTIATION_JSON === undefined
    ? undefined
    : readJson(env, "TMS_REAL_BOOK_NEGOTIATION_JSON") as unknown as NegotiationHandoffInput;
  const carrier = env.TMS_REAL_BOOK_CARRIER_VALIDATION_JSON === undefined
    ? undefined
    : readJson(env, "TMS_REAL_BOOK_CARRIER_VALIDATION_JSON") as unknown as CarrierValidationHandoffInput;
  return {
    query,
    runId: required(env, "TMS_REAL_BOOK_RUN_ID"),
    sessionId: required(env, "TMS_REAL_BOOK_SESSION_ID"),
    selectedLoadId: env.TMS_REAL_BOOK_SELECTED_LOAD_ID?.trim() || undefined,
    selectionConfirmed: env.TMS_REAL_BOOK_SELECTION_CONFIRMED === "true",
    negotiation,
    carrier,
    bookingConfirmed: env.TMS_REAL_BOOKING_CONFIRMED === "true",
  };
}

export function createBookingCapability(config: TmsConfig, authority?: RealBookingAuthority): TmsCommandPolicy {
  if (config.mode !== "real") return { scope: TMS_EXECUTION_SCOPES.MOCK_LOCAL };
  if (!authority) throw new TmsConfigurationError("Real booking capability requires an independent server authority.");
  return createServerRealBookingCapability(config, authority);
}

export async function runRealControlledBooking(
  config: TmsConfig,
  input: RealBookingRuntimeInput,
  capability: TmsCommandPolicy,
  connect: TmsConnect | undefined = undefined,
  hooks: RealBookingRunHooks = {},
): Promise<RealBookingRunResult> {
  if (config.mode === "real") {
    if (!hooks.authority || !hooks.handoffProvider?.authority || !hooks.handoffProvider.getBookingProof || !hooks.handoffProvider.getExpectedBookingClaims || !config.validatedTarget) {
      throw new TmsConfigurationError("Real booking requires independent authority, verified handoffs and an authority-validated TLS target.");
    }
  }
  const ownsDeadline = !hooks.deadline;
  const deadline = hooks.deadline ?? new DeadlineBudget(Math.min(MAX_TMS_DEADLINE_MS, config.connectTimeoutMs + config.responseTimeoutMs));
  let preserveDeadlineForReconciliation = false;
  try {
    const workflowCapability = config.mode === "real" ? createBookingCapability(config, hooks.authority) : capability;
    const port = createControlledBookingPort(config, workflowCapability, config.mode === "real" ? createTlsConnector(config.validatedTarget!) : connect ?? connectTcp, { budget: deadline });
    const ledger = config.mode === "real"
      ? new FileBookingAttemptLedger(required(process.env, "TMS_REAL_BOOKING_LEDGER_DIR"))
      : hooks.ledger ?? new InMemoryBookingAttemptLedger();
    const workflow = new ControlledBookingWorkflow(config, port, workflowCapability, () => Date.now(), undefined, ledger, deadline);
    const query = await workflow.query(input.query, input.runId, input.sessionId);
    const selection = input.selectedLoadId
      ? workflow.select(input.selectedLoadId, input.selectionConfirmed)
      : workflow.select(selectSoleLoadForValidation(query.run, input.selectionConfirmed).selectedLoadId, input.selectionConfirmed);
    const handoffContext = { loadId: selection.selectedLoadId, runId: query.run.runId, sessionId: query.run.sessionId };
    if (!hooks.handoffProvider && (!input.negotiation || !input.carrier)) {
      throw new TmsConfigurationError("A trusted real booking handoff provider is required.");
    }
    let detail: Awaited<ReturnType<ControlledBookingWorkflow["detail"]>>;
    let authorization: ControlledBookingAuthorization;
    if (config.mode === "real") {
      const provider = hooks.handoffProvider!;
      const expected = await deadline.runPhase(DEADLINE_PHASES.AUTH, (signal) => Promise.resolve(provider.getExpectedBookingClaims!(handoffContext, signal)));
      const envelope = await deadline.runPhase(DEADLINE_PHASES.AUTH, (signal) => Promise.resolve(provider.getBookingProof!(handoffContext, signal)));
      await deadline.runPhase(DEADLINE_PHASES.AUTH, async () => verifyBookingHandoff({
          envelope,
          expected: { ...handoffContext, ...expected },
          authority: provider.authority,
        }));
      detail = await workflow.detail();
      throw new TmsConfigurationError("Real booking authorization remains blocked until Phase 3 handoff integrations are approved.");
    } else {
      const negotiation = hooks.handoffProvider?.getNegotiation?.(handoffContext) ?? createNegotiationHandoff(input.negotiation!);
      const carrier = hooks.handoffProvider?.getCarrierValidation?.(handoffContext) ?? createCarrierValidationHandoff(input.carrier!);
      // Establish the handoff artifacts before the final exact-ID detail read.
      // Authorization is issued only after that fresh detail succeeds.
      detail = await workflow.detail();
      authorization = workflow.authorize(negotiation, carrier, input.bookingConfirmed);
    }
    hooks.onAuthorization?.(authorization, workflow);
    const booking = await workflow.book(authorization);
    return {
      query: { run: query.run, operation: query.operation.result },
      selection,
      detail: { load: detail.load, operation: detail.operation.result },
      authorization,
      booking: { booking: booking.booking, operation: booking.operation.result },
    };
  } catch (error) {
    preserveDeadlineForReconciliation = isPostWriteBookingUncertain(error);
    throw error;
  } finally {
    if (ownsDeadline && !preserveDeadlineForReconciliation) deadline.dispose();
  }
}

export function wasPostWriteUncertain(error: unknown): error is TmsAdapterError {
  return isTmsAdapterError(error) && isPostWriteBookingUncertain(error);
}

export async function reconcileRealBooking(
  workflow: ControlledBookingWorkflow,
  authorization: ControlledBookingAuthorization,
  classifier?: AuthoritativeReconciliationClassifier,
): Promise<{ load: SelectedLoad["load"]; outcome: "reconciled" | "still-uncertain"; operation: LoadOperationResult }> {
  const result = await workflow.reconcile(authorization, classifier);
  return { ...result, operation: result.operation.result };
}
