import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as search } from "../../app/api/tms/loads/search/route";
import { POST as detail } from "../../app/api/tms/loads/detail/route";
import { createMockLtmsServer } from "../../mock/ltms-server";

function configureTms(host: string, port: number): void {
  vi.stubEnv("TMS_HOST", host);
  vi.stubEnv("TMS_PORT", String(port));
  vi.stubEnv("TMS_AUTH_TOKEN", "test-token");
  vi.stubEnv("TMS_CONNECT_TIMEOUT_MS", "1000");
  vi.stubEnv("TMS_RESPONSE_TIMEOUT_MS", "1000");
  vi.stubEnv("ADAPTER_SHARED_SECRET", "adapter-secret");
}

const adapterHeaders = { "content-type": "application/json", "x-adapter-api-key": "adapter-secret" };

describe("read-only load routes", () => {
  let server: ReturnType<typeof createMockLtmsServer> | undefined;

  afterEach(async () => {
    await server?.stop();
    server = undefined;
    vi.unstubAllEnvs();
  });

  it("searches by the public DTO and does not expose MAX_BUY", async () => {
    server = createMockLtmsServer({ port: 0, authToken: "test-token" });
    const address = await server.start();
    configureTms(address.host, address.port);
    const response = await search(new Request("http://localhost/api/tms/loads/search", {
      method: "POST", body: JSON.stringify({ originState: "tx", equipmentType: "dry_van" }), headers: adapterHeaders,
    }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.loads).toHaveLength(1);
    expect(body.data.loads[0]).not.toHaveProperty("maxBuy");
    expect(JSON.stringify(body)).not.toContain("MAX_BUY");
  });

  it("gets a load detail and maps unknown loads to 404", async () => {
    server = createMockLtmsServer({ port: 0, authToken: "test-token" });
    const address = await server.start();
    configureTms(address.host, address.port);
    const found = await detail(new Request("http://localhost/api/tms/loads/detail", {
      method: "POST", body: JSON.stringify({ loadId: "LOAD-1002" }), headers: adapterHeaders,
    }));
    expect(found.status).toBe(200);
    expect((await found.json()).data.load.loadId).toBe("LOAD-1002");

    const missing = await detail(new Request("http://localhost/api/tms/loads/detail", {
      method: "POST", body: JSON.stringify({ loadId: "LOAD-404" }), headers: adapterHeaders,
    }));
    expect(missing.status).toBe(404);
    expect((await missing.json()).error.code).toBe("LOAD_NOT_FOUND");
  });

  it("rejects a search without a filter before opening a socket", async () => {
    vi.stubEnv("ADAPTER_SHARED_SECRET", "adapter-secret");
    const response = await search(new Request("http://localhost/api/tms/loads/search", {
      method: "POST", body: JSON.stringify({ maxResults: 2 }), headers: adapterHeaders,
    }));
    expect(response.status).toBe(400);
  });
});
