import { describe, expect, it } from "vitest";
import { sanitizeRealLoadEvidence } from "./real/load-evidence";

describe("real load evidence sanitization", () => {
  it("removes sensitive field names without retaining values", () => {
    const sanitized = sanitizeRealLoadEvidence({
      operation: "LOAD_GET",
      outcome: "success",
      durationMs: 10,
      recordCount: 1,
      fieldNames: [["LOAD_ID", "AUTH", "MAX_BUY", "NOTES", "STATUS", "TOKEN_VALUE"]],
      terminalEnd: true,
      lifecycle: "peer-close",
    });

    expect(sanitized.fieldNames).toEqual([["LOAD_ID", "STATUS"]]);
    expect(JSON.stringify(sanitized)).not.toContain("secret");
    expect(JSON.stringify(sanitized)).not.toContain("MAX_BUY");
    expect(JSON.stringify(sanitized)).not.toContain("NOTES");
  });

  it("rejects arbitrary evidence properties", () => {
    expect(() => sanitizeRealLoadEvidence({
      operation: "LOAD_QUERY",
      outcome: "success",
      durationMs: 1,
      extra: "secret",
    } as never)).toThrow(/unknown fields/i);
  });
});
