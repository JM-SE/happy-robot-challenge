import { describe, expect, it } from "vitest";
import { evaluateRuntimeReadiness } from "../../src/runtime/readiness";

const environment = { nodeEnvironment: "test", adapterMode: "mock" as const, realBookingEnabled: false as const, hasAdapterSecret: true };

describe("runtime readiness", () => {
  it("is pure and ready for a valid local process", () => {
    expect(evaluateRuntimeReadiness({ environment })).toEqual({ kind: "ready" });
  });

  it.each([
    [{ environment: undefined }, "invalid-environment"],
    [{ environment, shuttingDown: true }, "shutting-down"],
    [{ environment, managedResourceCount: 101 }, "resource-limit"],
  ] as const)("returns a closed reason for unsafe state", (input, reason) => {
    expect(evaluateRuntimeReadiness(input)).toEqual({ kind: "not-ready", reason });
  });
});
