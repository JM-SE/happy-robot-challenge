import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getTmsConfig } from "../../../src/tms/config";
import { assertRealTmsMode } from "../../../src/tms/policy";
import { isTmsAdapterError } from "../../../src/tms/errors";
import {
  createBookingCapability,
  readRealBookingRuntimeInput,
  reconcileRealBooking,
  runRealControlledBooking,
  wasPostWriteUncertain,
  type RealBookingRuntimeInput,
} from "./booking-probe";
import { writeSanitizedBookingEvidence, type SanitizedBookingEvidence } from "./booking-evidence";
import type { LoadOperationResult } from "../../../src/tms/controlled-booking";

function evidenceFor(
  stage: SanitizedBookingEvidence["stage"],
  operation: SanitizedBookingEvidence["operation"],
  result: LoadOperationResult,
  startedAt: number,
  outcome: SanitizedBookingEvidence["outcome"],
): SanitizedBookingEvidence {
  return {
    stage,
    operation,
    outcome,
    durationMs: Date.now() - startedAt,
    requestBytes: result.requestBytes,
    responseBytes: result.response.rawBytes,
    recordCount: result.response.records.length,
    fieldNames: result.response.records.map((record) => Object.keys(record.fields)),
    terminalEnd: true,
    lifecycle: "peer-close",
    attemptCount: stage === "booking" ? 1 : 0,
    rollbackAvailable: false,
    reconciliation: stage === "reconciliation" ? "best-effort" : "not-applicable",
  };
}

function errorEvidence(
  stage: SanitizedBookingEvidence["stage"],
  operation: SanitizedBookingEvidence["operation"],
  error: unknown,
  startedAt: number,
  outcome: SanitizedBookingEvidence["outcome"],
): SanitizedBookingEvidence {
  const adapterError = isTmsAdapterError(error) ? error : undefined;
  return {
    stage,
    operation,
    outcome,
    durationMs: Date.now() - startedAt,
    errorType: adapterError?.type,
    remoteCode: adapterError?.metadata.remoteCode,
    attemptCount: stage === "booking" ? 1 : 0,
    rollbackAvailable: false,
    reconciliation: stage === "reconciliation" ? "best-effort" : "not-applicable",
    lifecycle: adapterError?.type === "TMS_REMOTE" ? "remote-error" : "transport-error",
  };
}

describe("authorized real TMS controlled booking", () => {
  let config!: ReturnType<typeof getTmsConfig>;
  let input!: RealBookingRuntimeInput;
  let authorization: Parameters<typeof reconcileRealBooking>[1] | undefined;
  const evidence: SanitizedBookingEvidence[] = [];

  beforeAll(() => {
    config = getTmsConfig();
    assertRealTmsMode(config);
    input = readRealBookingRuntimeInput();
  });

  afterAll(async () => {
    if (evidence.length > 0) await writeSanitizedBookingEvidence(evidence);
  });

  it("performs the approved query-derived one-shot workflow", async () => {
    const startedAt = Date.now();
    const capability = createBookingCapability(config);
    try {
      const result = await runRealControlledBooking(config, input, capability, undefined, {
        onAuthorization: (created) => { authorization = created; },
      });
      evidence.push(evidenceFor("query", "LOAD_QUERY", result.query.operation, startedAt, "success"));
      evidence.push({
        stage: "selection",
        operation: "LOAD_QUERY",
        outcome: "success",
        durationMs: Date.now() - startedAt,
        recordCount: 1,
        attemptCount: 0,
        rollbackAvailable: false,
        reconciliation: "not-applicable",
        lifecycle: "not-run",
      });
      evidence.push(evidenceFor("detail", "LOAD_GET", result.detail.operation, startedAt, "success"));
      evidence.push(evidenceFor("booking", "LOAD_BOOK", result.booking.operation, startedAt, "success"));
      expect(result.selection.explicitSelectionConfirmed).toBe(true);
      expect(result.detail.load.loadId).toBe(result.selection.selectedLoadId);
      expect(result.booking.booking.loadId).toBe(result.selection.selectedLoadId);
    } catch (error) {
      const command = isTmsAdapterError(error) ? error.metadata.command : undefined;
      const stage = command === "LOAD_QUERY" ? "query" : command === "LOAD_BOOK" ? "booking" : "detail";
      const operation = command === "LOAD_QUERY" ? "LOAD_QUERY" : command === "LOAD_BOOK" ? "LOAD_BOOK" : "LOAD_GET";
      evidence.push(errorEvidence(stage, operation, error, startedAt, wasPostWriteUncertain(error) ? "side-effect-uncertain" : "deterministic-error"));
      if (wasPostWriteUncertain(error) && authorization) {
        const reconciliationStartedAt = Date.now();
        try {
          const reconciliation = await reconcileRealBooking(config, authorization);
          evidence.push(evidenceFor("reconciliation", "LOAD_GET", reconciliation.operation, reconciliationStartedAt, reconciliation.outcome));
        } catch (reconciliationError) {
          evidence.push(errorEvidence("reconciliation", "LOAD_GET", reconciliationError, reconciliationStartedAt, "still-uncertain"));
        }
      }
      throw error;
    }
  });

  it("does not reconcile deterministic errors as side-effect uncertainty", async () => {
    expect(wasPostWriteUncertain(new Error("deterministic failure"))).toBe(false);
  });
});
