import { describe, expect, it, vi } from "vitest";
import { TmsClient } from "../../src/tms/client";
import { TmsConfigurationError } from "../../src/tms/errors";
import { assertRealTmsMode } from "../../src/tms/policy";
import { testConfig } from "./test-helpers";

describe("TMS activation policy", () => {
  it("rejects real operational commands before invoking the connector", async () => {
    const connect = vi.fn(() => {
      throw new Error("connector must not be called");
    });
    const client = new TmsClient(testConfig({ mode: "real" }), connect);

    await expect(client.execute({ command: "LOAD_QUERY" })).rejects.toBeInstanceOf(TmsConfigurationError);
    expect(connect).not.toHaveBeenCalled();
  });

  it("accepts explicit real mode only for the real runner", () => {
    expect(() => assertRealTmsMode(testConfig({ mode: "real" }))).not.toThrow();
    expect(() => assertRealTmsMode(testConfig({ mode: "mock" }))).toThrow(TmsConfigurationError);
  });
});
