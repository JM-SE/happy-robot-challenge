import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { sanitizeBookingEvidence, writeSanitizedBookingEvidence, type SanitizedBookingEvidence } from "./real/booking-evidence";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

const evidence: SanitizedBookingEvidence = {
  stage: "booking",
  operation: "LOAD_BOOK",
  outcome: "success",
  durationMs: 12.9,
  requestBytes: 60,
  responseBytes: 100,
  recordCount: 1,
  fieldNames: [["STATUS", "LOAD_ID", "NOTES", "RATE", "ORIG_STATE"]],
  terminalEnd: true,
  lifecycle: "peer-close",
  errorType: "TMS_PROTOCOL",
  remoteCode: "SAFE_CODE",
  attemptCount: 1,
  rollbackAvailable: false,
  reconciliation: "not-applicable",
};

describe("controlled booking evidence boundary", () => {
  it("constructs a positive sanitized shape without sensitive field names or arbitrary properties", () => {
    expect(() => sanitizeBookingEvidence({ ...evidence, rawLine: "secret", token: "secret", id: "secret" } as SanitizedBookingEvidence & Record<string, unknown>)).toThrow(/unknown fields/i);
    const value = sanitizeBookingEvidence(evidence);

    expect(value).toEqual({
      stage: "booking",
      operation: "LOAD_BOOK",
      outcome: "success",
      durationMs: 12,
      attemptCount: 1,
      rollbackAvailable: false,
      reconciliation: "not-applicable",
      lifecycle: "peer-close",
      requestBytes: 60,
      responseBytes: 100,
      recordCount: 1,
      fieldNames: [["ORIG_STATE", "STATUS"]],
      terminalEnd: true,
      errorType: "TMS_PROTOCOL",
      remoteCode: "SAFE_CODE",
    });
    expect(JSON.stringify(value)).not.toMatch(/rawLine|token|secret|LOAD_ID|RATE|NOTES/);
  });

  it("writes a unique create-only report without overwriting an existing report", async () => {
    const directory = await mkdtemp(join(tmpdir(), "happyrobot-evidence-"));
    temporaryDirectories.push(directory);
    const first = await writeSanitizedBookingEvidence([evidence], directory);
    const second = await writeSanitizedBookingEvidence([evidence], directory);

    expect(first).not.toBe(second);
    const firstContent = JSON.parse(await readFile(first, "utf8")) as { schemaVersion: number; provenance: string; probes: unknown[] };
    const secondContent = JSON.parse(await readFile(second, "utf8")) as { schemaVersion: number; provenance: string; probes: unknown[] };
    expect(firstContent.schemaVersion).toBe(1);
    expect(firstContent.provenance).toBe("sanitized-real-tms-phase-2c-runner-output");
    expect(firstContent.probes).toHaveLength(1);
    expect(secondContent.provenance).toBe("sanitized-real-tms-phase-2c-runner-output");
    expect(secondContent.probes).toHaveLength(1);
  });

  it("bounds nested field evidence and the report probe collection", () => {
    const value = sanitizeBookingEvidence({
      ...evidence,
      fieldNames: Array.from({ length: 200 }, () => Array.from({ length: 200 }, () => "STATUS")),
    });
    expect(value.fieldNames).toHaveLength(128);
    expect(value.fieldNames?.[0]).toHaveLength(32);
  });
});
