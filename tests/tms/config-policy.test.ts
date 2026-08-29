import { describe, expect, it } from "vitest";
import { ADAPTER_MODES, CONFIG_FAILURE_CODES, evaluateAdapterEnvironment, evaluatePublicBooking, PUBLIC_BOOKING_DECISIONS } from "../../src/tms/config-policy";

const valid = () => ({ adapterMode: "mock", sharedSecret: "test-secret", tmsMode: "mock", nodeEnv: "test" });

describe("adapter configuration policy", () => {
  it("defaults to mock and rejects missing secrets", () => {
    expect(evaluateAdapterEnvironment({ ...valid(), adapterMode: undefined })).toMatchObject({ ok: true, mode: ADAPTER_MODES.MOCK });
    expect(evaluateAdapterEnvironment({ ...valid(), sharedSecret: "  " })).toMatchObject({ ok: false, code: CONFIG_FAILURE_CODES.MISSING_SECRET });
  });

  it("requires a strong secret only in production", () => {
    expect(evaluateAdapterEnvironment({ ...valid(), sharedSecret: "short", nodeEnv: "test" }).ok).toBe(true);
    expect(evaluateAdapterEnvironment({ ...valid(), sharedSecret: "short", nodeEnv: "production" })).toMatchObject({ ok: false, code: CONFIG_FAILURE_CODES.WEAK_PRODUCTION_SECRET });
    expect(evaluateAdapterEnvironment({ ...valid(), sharedSecret: "x".repeat(32), nodeEnv: "production" }).ok).toBe(true);
  });

  it.each([
    { adapterMode: "other" },
    { adapterMode: "real", tmsMode: "mock" },
    { adapterMode: "mock", tmsMode: "real" },
    { realBookingEnabled: "true" },
    { realBookingEnabled: "TRUE" },
  ])("rejects unsafe configuration %j", (override) => {
    expect(evaluateAdapterEnvironment({ ...valid(), ...override })).toMatchObject({ ok: false });
  });

  it("keeps public booking mode decisions explicit", () => {
    expect(evaluatePublicBooking(ADAPTER_MODES.MOCK)).toBe(PUBLIC_BOOKING_DECISIONS.MOCK_ALLOWED);
    expect(evaluatePublicBooking(ADAPTER_MODES.REAL)).toBe(PUBLIC_BOOKING_DECISIONS.REAL_DISABLED);
  });
});
