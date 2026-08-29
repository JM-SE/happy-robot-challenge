import { describe, expect, it } from "vitest";
import { serializeFilters } from "../../src/operations/lib/filters";

describe("operations filters", () => {
  it("serializes the complete public filter allowlist", () => {
    expect(serializeFilters({ outcome: "FAILED_NEGOTIATION", fmcsaStatus: "VERIFIED", otpStatus: "UNAVAILABLE", bookingStatus: "FAILED", mode: "demo", from: "2026-08-01", to: "2026-08-31", secret: "drop" })).toBe("outcome=FAILED_NEGOTIATION&fmcsaStatus=VERIFIED&otpStatus=UNAVAILABLE&bookingStatus=FAILED&mode=demo&from=2026-08-01&to=2026-08-31");
  });

  it("omits empty values and unknown fields", () => {
    expect(serializeFilters({ outcome: "", mode: "", MAX_BUY: "9999" })).toBe("");
  });
});
