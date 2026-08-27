import { afterEach, describe, expect, it } from "vitest";
import { TmsClient } from "../../src/tms/client";
import { createMockLtmsServer } from "../../mock/ltms-server";
import type { TmsConfig } from "../../src/tms/types";

describe("read-only load TCP integration", () => {
  let server: ReturnType<typeof createMockLtmsServer> | undefined;

  afterEach(async () => {
    await server?.stop();
    server = undefined;
  });

  it("returns multiple filtered records and preserves the read-only dataset", async () => {
    server = createMockLtmsServer({ port: 0, authToken: "token" });
    const address = await server.start();
    const config: TmsConfig = { mode: "mock", host: address.host, port: address.port, authToken: "token", connectTimeoutMs: 1000, responseTimeoutMs: 1000, maxFrameBytes: 4096 };
    const client = new TmsClient(config);
    const first = await client.execute({ command: "LOAD_QUERY", fields: { ORIG_STATE: "TX" } });
    const second = await client.execute({ command: "LOAD_QUERY", fields: { MAX_RESULTS: 2, DEST_STATE: "CA" } });
    expect(first.records).toHaveLength(1);
    expect(second.records).toHaveLength(1);
    expect(server.connectionCount).toBe(2);
    expect(server.requestCount).toBe(2);
  });

  it("accepts ZIP-only filters and applies them without inventing dataset matches", async () => {
    server = createMockLtmsServer({ port: 0, authToken: "token" });
    const address = await server.start();
    const config: TmsConfig = { mode: "mock", host: address.host, port: address.port, authToken: "token", connectTimeoutMs: 1000, responseTimeoutMs: 1000, maxFrameBytes: 4096 };
    const client = new TmsClient(config);

    const response = await client.execute({ command: "LOAD_QUERY", fields: { ORIG_ZIP: "75201" } });

    expect(response.records).toEqual([]);
    expect(server.requestCount).toBe(1);
    expect(server.dispatchCount).toBe(1);
  });
});
