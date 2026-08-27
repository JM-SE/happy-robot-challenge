import { afterEach, describe, expect, it } from "vitest";
import { TmsClient } from "../../src/tms/client";
import { TmsRemoteError } from "../../src/tms/errors";
import { createMockLtmsServer } from "../../mock/ltms-server";
import type { TmsConfig } from "../../src/tms/types";

describe("local LTMS TCP integration", () => {
  let server: ReturnType<typeof createMockLtmsServer> | undefined;

  afterEach(async () => {
    await server?.stop();
    server = undefined;
  });

  it("sends DEBUG_ECHO over a real TCP socket", async () => {
    server = createMockLtmsServer({ port: 0, authToken: "token" });
    const address = await server.start();
    const config: TmsConfig = { mode: "mock", host: address.host, port: address.port, authToken: "token", connectTimeoutMs: 1000, responseTimeoutMs: 1000, maxFrameBytes: 4096 };
    const response = await new TmsClient(config).execute({ command: "DEBUG_ECHO", fields: { MSG: "hello" } });
    expect(response.records[0].fields).toEqual({ MSG: "hello", FIELD_COUNT: "3" });
    expect(server.connectionCount).toBe(1);
    expect(server.requestCount).toBe(1);
  });

  it("turns a remote ERR into a structured error", async () => {
    server = createMockLtmsServer({ port: 0, authToken: "right-token" });
    const address = await server.start();
    const config: TmsConfig = { mode: "mock", host: address.host, port: address.port, authToken: "wrong-token", connectTimeoutMs: 1000, responseTimeoutMs: 1000, maxFrameBytes: 4096 };
    await expect(new TmsClient(config).execute({ command: "DEBUG_ECHO", fields: { MSG: "hello" } })).rejects.toBeInstanceOf(TmsRemoteError);
  });
});
