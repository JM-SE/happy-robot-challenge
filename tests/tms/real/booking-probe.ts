import { buildRequest } from "../../../src/tms/protocol";
import { createCarrierValidationHandoff, createNegotiationHandoff, ControlledBookingWorkflow, isPostWriteBookingUncertain, selectSoleLoadForValidation, type CarrierValidationHandoffInput, type ControlledBookingAuthorization, type NegotiationHandoffInput } from "../../../src/tms/controlled-booking";
import { TmsClient } from "../../../src/tms/client";
import { createRealBookingCapability, type RealBookingCapability } from "../../../src/tms/policy";
import { isTmsAdapterError, type TmsAdapterError } from "../../../src/tms/errors";
import { parseLoadQueryInput, recordToPublicLoad, toLoadDetailFields } from "../../../src/tms/loads";
import type { LoadOperationResult, QueryRun, SelectedLoad } from "../../../src/tms/controlled-booking";
import type { BookingPublic, LoadQueryInput, TmsConfig } from "../../../src/tms/types";
import { connectTcp, type TmsConnect } from "../../../src/tms/transport";

export interface RealBookingRuntimeInput {
  query: LoadQueryInput;
  runId: string;
  sessionId: string;
  selectedLoadId?: string;
  selectionConfirmed: boolean;
  negotiation: NegotiationHandoffInput;
  carrier: CarrierValidationHandoffInput;
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
  onAuthorization?: (authorization: ControlledBookingAuthorization) => void;
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
  const query = parseLoadQueryInput(readJson(env, "TMS_REAL_BOOK_QUERY_JSON"));
  const negotiation = readJson(env, "TMS_REAL_BOOK_NEGOTIATION_JSON") as unknown as NegotiationHandoffInput;
  const carrier = readJson(env, "TMS_REAL_BOOK_CARRIER_VALIDATION_JSON") as unknown as CarrierValidationHandoffInput;
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

export function createBookingCapability(config: TmsConfig, env: NodeJS.ProcessEnv = process.env): RealBookingCapability {
  return createRealBookingCapability(config, env.TMS_REAL_BOOKING_CONFIRMED === "true");
}

function requestBytes(config: TmsConfig, command: "LOAD_QUERY" | "LOAD_GET" | "LOAD_BOOK", fields: Record<string, string | number>): number {
  return buildRequest({ command, authToken: config.authToken, fields }, config.maxFrameBytes).byteLength;
}

export async function runRealControlledBooking(
  config: TmsConfig,
  input: RealBookingRuntimeInput,
  capability: RealBookingCapability,
  connect: TmsConnect = connectTcp,
  hooks: RealBookingRunHooks = {},
): Promise<RealBookingRunResult> {
  const client = new TmsClient(config, connect, capability);
  const workflow = new ControlledBookingWorkflow(config, client, capability);
  const query = await workflow.query(input.query, input.runId, input.sessionId);
  const selection = input.selectedLoadId
    ? workflow.select(input.selectedLoadId, input.selectionConfirmed)
    : workflow.select(selectSoleLoadForValidation(query.run, input.selectionConfirmed).selectedLoadId, input.selectionConfirmed);
  const detail = await workflow.detail();
  const negotiation = createNegotiationHandoff({ ...input.negotiation, loadId: input.negotiation.loadId, runId: query.run.runId, sessionId: query.run.sessionId });
  const carrier = createCarrierValidationHandoff({ ...input.carrier, loadId: input.carrier.loadId, runId: query.run.runId, sessionId: query.run.sessionId });
  const authorization = workflow.authorize(negotiation, carrier, input.bookingConfirmed);
  hooks.onAuthorization?.(authorization);
  const booking = await workflow.book(authorization);
  return {
    query: { run: query.run, operation: query.operation.result },
    selection,
    detail: { load: detail.load, operation: detail.operation.result },
    authorization,
    booking: { booking: booking.booking, operation: booking.operation.result },
  };
}

export function wasPostWriteUncertain(error: unknown): error is TmsAdapterError {
  return isTmsAdapterError(error) && isPostWriteBookingUncertain(error);
}

export async function reconcileRealBooking(
  config: TmsConfig,
  authorization: ControlledBookingAuthorization,
  connect: TmsConnect = connectTcp,
  confirmsBookingState: (load: SelectedLoad["load"]) => boolean = () => false,
): Promise<{ load: SelectedLoad["load"]; outcome: "reconciled" | "still-uncertain"; operation: LoadOperationResult }> {
  const client = new TmsClient(config, connect, authorization.policy);
  authorization.consumeReconciliation();
  const fields = toLoadDetailFields({ loadId: authorization.context.selection.selectedLoadId });
  const response = await client.execute({ command: "LOAD_GET", fields, requestId: "phase-2c-reconciliation" });
  if (response.records.length !== 1) throw new Error("Reconciliation detail must contain exactly one record.");
  const load = recordToPublicLoad(response.records[0]!);
  if (load.loadId !== authorization.context.selection.selectedLoadId) throw new Error("Reconciliation load ID does not match the selected load.");
  return { load, outcome: confirmsBookingState(load) ? "reconciled" : "still-uncertain", operation: { response, requestBytes: requestBytes(config, "LOAD_GET", fields) } };
}
