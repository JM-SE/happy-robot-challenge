import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getTmsConfig } from "../../../src/tms/config";
import { parseLoadDetailInput, parseLoadQueryInput } from "../../../src/tms/loads";
import { assertRealTmsMode } from "../../../src/tms/policy";
import { isTmsAdapterError, type TmsAdapterError } from "../../../src/tms/errors";
import type { LoadQueryInput, TmsConfig } from "../../../src/tms/types";
import { runRealLoadDetail, runRealLoadQuery, type RealLoadOperationResult } from "./load-probe";
import { writeSanitizedRealLoadEvidence, type SanitizedRealLoadProbeEvidence } from "./load-evidence";

function readQueryInput(): LoadQueryInput {
  const raw = process.env.TMS_REAL_LOAD_QUERY_JSON;
  if (!raw) throw new Error("Missing TMS_REAL_LOAD_QUERY_JSON; provide an approved read-only query as runtime configuration.");
  try {
    return parseLoadQueryInput(JSON.parse(raw) as unknown);
  } catch {
    throw new Error("TMS_REAL_LOAD_QUERY_JSON must contain a valid read-only LOAD_QUERY body.");
  }
}

function evidenceFor(operation: "LOAD_QUERY" | "LOAD_GET", result: RealLoadOperationResult, startedAt: number): SanitizedRealLoadProbeEvidence {
  return {
    operation,
    outcome: "success",
    durationMs: Date.now() - startedAt,
    requestBytes: result.requestBytes,
    responseBytes: result.response.rawBytes,
    recordCount: result.response.records.length,
    recordTypes: result.response.records.map((record) => record.recordType ?? "fields-only"),
    fieldNames: result.response.records.map((record) => Object.keys(record.fields).sort()),
    terminalEnd: true,
    lifecycle: "peer-close",
  };
}

describe("authorized real TMS read-only loads", () => {
  let config!: TmsConfig;
  let queryInput!: LoadQueryInput;
  const evidence: SanitizedRealLoadProbeEvidence[] = [];

  beforeAll(() => {
    config = getTmsConfig();
    assertRealTmsMode(config);
    queryInput = readQueryInput();
  });

  afterAll(async () => {
    if (evidence.length > 0) await writeSanitizedRealLoadEvidence(evidence);
  });

  it("executes an authorized read-only LOAD_QUERY", async () => {
    const startedAt = Date.now();
    try {
      const result = await runRealLoadQuery(config, queryInput, "phase-2b-query");
      evidence.push(evidenceFor("LOAD_QUERY", result, startedAt));
      expect(result.loads.length).toBe(result.response.records.length);
      expect(result.loads.every((load) => !Object.prototype.hasOwnProperty.call(load, "maxBuy"))).toBe(true);
    } catch (error) {
      if (isTmsAdapterError(error)) evidence.push({ operation: "LOAD_QUERY", outcome: "error", durationMs: Date.now() - startedAt, lifecycle: error.type === "TMS_REMOTE" ? "remote-error" : "not-run", remoteCode: (error as TmsAdapterError).metadata.remoteCode });
      throw error;
    }
  });

  it("executes LOAD_GET only when an approved load id is available", async () => {
    const queryResult = await runRealLoadQuery(config, queryInput, "phase-2b-query-for-detail");
    const configuredId = process.env.TMS_REAL_LOAD_ID;
    const loadId = configuredId ?? queryResult.loads[0]?.loadId;
    if (!loadId) {
      evidence.push({ operation: "LOAD_GET", outcome: "precondition-not-met", durationMs: 0, lifecycle: "not-run", reason: "no-load-id-observed" });
      expect(queryResult.loads).toHaveLength(0);
      return;
    }

    const detailInput = parseLoadDetailInput({ loadId });
    const startedAt = Date.now();
    try {
      const result = await runRealLoadDetail(config, detailInput, "phase-2b-detail");
      evidence.push(evidenceFor("LOAD_GET", result, startedAt));
      expect(result.loads).toHaveLength(1);
      expect(Object.prototype.hasOwnProperty.call(result.loads[0], "maxBuy")).toBe(false);
    } catch (error) {
      if (isTmsAdapterError(error)) evidence.push({ operation: "LOAD_GET", outcome: "error", durationMs: Date.now() - startedAt, lifecycle: error.type === "TMS_REMOTE" ? "remote-error" : "not-run", remoteCode: (error as TmsAdapterError).metadata.remoteCode });
      throw error;
    }
  });
});
