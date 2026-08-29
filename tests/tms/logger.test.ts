import { afterEach, describe, expect, it, vi } from "vitest";
import { logTmsEvent } from "../../src/tms/logger";

describe("safe TMS logging", () => {
  afterEach(() => vi.restoreAllMocks());

  it("emits only bounded allowlisted operational metadata", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    logTmsEvent({
      command: "ATTACK_RAW_COMMAND",
      requestId: "safe-id",
      durationMs: Number.MAX_VALUE,
      outcome: "error",
      errorType: "SECRET_AND_STACK",
      remoteCode: "MC-12345",
      recordCount: Number.MAX_VALUE,
    });

    expect(info).toHaveBeenCalledWith("[tms]", {
      operation: "other",
      requestId: "safe-id",
      durationMs: 600000,
      outcome: "error",
      errorType: undefined,
      recordCount: 128,
    });
    expect(JSON.stringify(info.mock.calls)).not.toContain("MC-12345");
  });
});
