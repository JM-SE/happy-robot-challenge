import { afterEach, describe, expect, it, vi } from "vitest";
import { TmsResponseIncompleteError } from "../../src/tms/errors";
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

    expect(info).toHaveBeenCalledWith("[tms]", JSON.stringify({
      operation: "other",
      requestId: "safe-id",
      durationMs: 600000,
      outcome: "error",
      recordCount: 128,
    }));
    expect(JSON.stringify(info.mock.calls)).not.toContain("MC-12345");
  });

  it("preserves the safe incomplete-response classification", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    logTmsEvent({
      command: "LOAD_QUERY",
      requestId: "safe-id",
      durationMs: 334,
      outcome: "error",
      errorType: new TmsResponseIncompleteError().type,
    });

    expect(info).toHaveBeenCalledWith("[tms]", expect.stringContaining('"operation":"search"'));
    expect(info.mock.calls[0]?.[1]).toContain('"errorType":"TMS_RESPONSE_INCOMPLETE"');
  });
});
