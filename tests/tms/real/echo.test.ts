import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildRequest } from "../../../src/tms/protocol";
import { getTmsConfig } from "../../../src/tms/config";
import { responseToEchoResult } from "../../../src/tms/echo";
import { isTmsAdapterError, type TmsAdapterError } from "../../../src/tms/errors";
import { assertRealTmsMode } from "../../../src/tms/policy";
import { TmsClient } from "../../../src/tms/client";
import type { TmsConfig } from "../../../src/tms/types";
import { writeSanitizedRealEvidence, type SanitizedRealProbeEvidence } from "./evidence";
import { DeadlineBudget } from "../../../src/tms/deadline";
import { MAX_TMS_DEADLINE_MS } from "../../../src/tms/limits";

describe("authorized real TMS DEBUG_ECHO", () => {
  let config!: TmsConfig;
  const evidence: SanitizedRealProbeEvidence[] = [];

  beforeAll(() => {
    config = getTmsConfig();
    assertRealTmsMode(config);
  });

  afterAll(async () => {
    if (evidence.length > 0) await writeSanitizedRealEvidence(evidence);
  });

  let deadline!: DeadlineBudget;

  beforeAll(() => {
    deadline = new DeadlineBudget(Math.min(MAX_TMS_DEADLINE_MS, config.connectTimeoutMs + config.responseTimeoutMs));
  });

  afterAll(() => deadline.dispose());

  const runSuccessProbe = async (probe: string, fields: Record<string, string>): Promise<void> => {
    const requestBytes = await deadline.runPhase("mapping", async () =>
      buildRequest({ command: "DEBUG_ECHO", authToken: config.authToken, fields }, config.maxFrameBytes).byteLength);
    const startedAt = Date.now();
    const response = await new TmsClient(config, undefined, undefined, undefined, { budget: deadline }).execute({ command: "DEBUG_ECHO", fields, requestId: `phase-2a-${probe}` });
    const data = responseToEchoResult(response);

    evidence.push({
      probe,
      outcome: "success",
      durationMs: Date.now() - startedAt,
      requestBytes,
      responseBytes: response.rawBytes,
      recordCount: response.records.length,
      recordTypes: response.records.map((record) => record.recordType ?? "fields-only"),
      fieldNames: response.records.map((record) => Object.keys(record.fields).sort()),
      terminalEnd: true,
      lifecycle: "peer-close",
    });

    return expect(data).toEqual({ message: fields.MSG, fieldCount: fields.X ? 6 : 3 });
  };

  it("completes the official HELLO round trip", async () => {
    await runSuccessProbe("base", { MSG: "HELLO" });
  });

  it.skipIf(process.env.TMS_REAL_ECHO_EXTRAS !== "true")("counts and discards X/Y/Z fields", async () => {
    await runSuccessProbe("extras", { MSG: "probe-7", X: "1", Y: "2", Z: "3" });
  });

  it.skipIf(process.env.TMS_REAL_ECHO_AUTH_INVALID !== "true")("classifies explicitly authorized invalid authentication", async () => {
    const invalidConfig: TmsConfig = { ...config, authToken: "invalid-real-tms-token" };
    const requestFields = { MSG: "HELLO" };
    const requestBytes = await deadline.runPhase("mapping", async () =>
      buildRequest({ command: "DEBUG_ECHO", authToken: invalidConfig.authToken, fields: requestFields }, invalidConfig.maxFrameBytes).byteLength);
    const startedAt = Date.now();

    try {
      await new TmsClient(invalidConfig, undefined, undefined, undefined, { budget: deadline }).execute({ command: "DEBUG_ECHO", fields: requestFields, requestId: "phase-2a-invalid-auth" });
      throw new Error("The real TMS accepted the explicitly invalid authentication probe.");
    } catch (error) {
      expect(isTmsAdapterError(error)).toBe(true);
      const adapterError = error as TmsAdapterError;
      expect(adapterError.type).toBe("TMS_REMOTE");
      expect(adapterError.code).toBe("AUTH_FAILED");
      expect(adapterError.retryable).toBe(false);
      evidence.push({
        probe: "invalid-auth",
        outcome: "error",
        durationMs: Date.now() - startedAt,
        requestBytes,
        terminalEnd: false,
        lifecycle: "remote-error",
        remoteCode: adapterError.code,
      });
    }
  });
});
