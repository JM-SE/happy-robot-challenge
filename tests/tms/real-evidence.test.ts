import { describe, expect, it } from "vitest";
import { sanitizeRealProbeEvidence } from "./real/evidence";

describe("real echo evidence sanitization", () => {
  it("constructs an allowlisted shape and rejects arbitrary properties", () => {
    expect(() => sanitizeRealProbeEvidence({
      probe: "base", outcome: "success", durationMs: Number.MAX_VALUE, requestBytes: 20,
      terminalEnd: true, lifecycle: "peer-close",
    })).toThrow(/bounded/i);
    expect(() => sanitizeRealProbeEvidence({
      probe: "base",
      outcome: "success",
      durationMs: 4,
      requestBytes: 20,
      terminalEnd: true,
      lifecycle: "peer-close",
      rawLine: "secret",
    } as never)).toThrow(/unknown fields/i);

    expect(sanitizeRealProbeEvidence({
      probe: "base",
      outcome: "success",
      durationMs: 4.9,
      requestBytes: 20,
      fieldNames: [["MSG", "TOKEN", "X"]],
      terminalEnd: true,
      lifecycle: "peer-close",
    })).toEqual({
      probe: "base",
      outcome: "success",
      durationMs: 4,
      requestBytes: 20,
      terminalEnd: true,
      lifecycle: "peer-close",
      fieldNames: [["MSG", "X"]],
    });
  });
});
