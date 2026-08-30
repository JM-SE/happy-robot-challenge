import { describe, expect, it } from "vitest";
import { readRuntimeEnvironment } from "../../src/runtime/environment";

describe("runtime environment", () => {
  it("defaults to mock and never enables booking", () => {
    const result = readRuntimeEnvironment({ ADAPTER_SHARED_SECRET: "local-secret" });
    expect(result).toEqual({ ok: true, environment: { nodeEnvironment: undefined, adapterMode: "mock", realBookingEnabled: false, hasAdapterSecret: true } });
  });

  it.each(["true", "TRUE", " false", "", "unsafe"])("rejects unsafe booking flag %j", (value) => {
    expect(readRuntimeEnvironment({ REAL_BOOKING_ENABLED: value })).toEqual({ ok: false, reason: "UNSAFE_BOOKING_FLAG" });
  });

  it("rejects unknown adapter modes without exposing the value", () => {
    expect(readRuntimeEnvironment({ ADAPTER_MODE: "remote-secret-target" })).toEqual({ ok: false, reason: "INVALID_ADAPTER_MODE" });
  });
});
