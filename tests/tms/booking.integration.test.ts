import { afterEach, describe, expect, it } from "vitest";
import { TmsClient } from "../../src/tms/client";
import { TmsRemoteError } from "../../src/tms/errors";
import { createMockLtmsServer } from "../../mock/ltms-server";
import type { TmsConfig } from "../../src/tms/types";

describe("stateful booking TCP integration", () => {
  let server: ReturnType<typeof createMockLtmsServer> | undefined;

  afterEach(async () => {
    await server?.stop();
    server = undefined;
  });

  it("permits one booking and rejects a duplicate", async () => {
    server = createMockLtmsServer({ port: 0, authToken: "token" });
    const address = await server.start();
    const config: TmsConfig = { host: address.host, port: address.port, authToken: "token", connectTimeoutMs: 1000, responseTimeoutMs: 1000, maxFrameBytes: 4096 };
    const client = new TmsClient(config);
    await expect(client.execute({ command: "LOAD_BOOK", fields: { LOAD_ID: "LOAD-1001", MC_NUM: "12345", AGREED_RATE: 2200 } })).resolves.toBeDefined();
    await expect(client.execute({ command: "LOAD_BOOK", fields: { LOAD_ID: "LOAD-1001", MC_NUM: "12345", AGREED_RATE: 2200 } })).rejects.toMatchObject({ code: "ALREADY_BOOKED" });
    expect(server.connectionCount).toBe(2);
  });

  it("isolates state between mock instances and exposes server errors safely", async () => {
    const first = createMockLtmsServer({ port: 0, authToken: "token", bookingServerError: true });
    server = first;
    const firstAddress = await first.start();
    const config: TmsConfig = { host: firstAddress.host, port: firstAddress.port, authToken: "token", connectTimeoutMs: 1000, responseTimeoutMs: 1000, maxFrameBytes: 4096 };
    await expect(new TmsClient(config).execute({ command: "LOAD_BOOK", fields: { LOAD_ID: "LOAD-1001", MC_NUM: "12345", AGREED_RATE: 2200 } })).rejects.toBeInstanceOf(TmsRemoteError);
  });
});
