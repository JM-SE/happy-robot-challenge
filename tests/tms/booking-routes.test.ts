import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../../app/api/tms/loads/book/route";
import { createMockLtmsServer } from "../../mock/ltms-server";

describe("POST /api/tms/loads/book", () => {
  let server: ReturnType<typeof createMockLtmsServer> | undefined;

  afterEach(async () => {
    await server?.stop();
    server = undefined;
    vi.unstubAllEnvs();
  });

  it("returns the deterministic mock demo booking without connecting to TCP", async () => {
    server = createMockLtmsServer({ port: 0, authToken: "test-token" });
    const address = await server.start();
    vi.stubEnv("ADAPTER_SHARED_SECRET", "adapter-secret");
    const response = await POST(new Request(`http://${address.host}:${address.port}/api/tms/loads/book`, {
      method: "POST",
       body: JSON.stringify({ loadId: "LOAD-1002", mc: "demo-mc", agreedRate: 2900 }),
      headers: { "content-type": "application/json", "x-adapter-api-key": "adapter-secret" },
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, data: { booking: { bookingRef: "BOOK-LOAD-1002", loadId: "LOAD-1002", agreedRate: 2900, bookedAt: "2000-01-01T00:00:00.000Z", mode: "mock", demo: true } }, meta: { requestId: expect.any(String) } });
    expect(server.requestCount).toBe(0);
  });

  it("rejects malformed JSON at the request boundary", async () => {
    vi.stubEnv("ADAPTER_SHARED_SECRET", "adapter-secret");
    const response = await POST(new Request("http://localhost/api/tms/loads/book", {
      method: "POST",
      body: "not-json",
      headers: { "content-type": "application/json", "x-adapter-api-key": "adapter-secret" },
    }));

    expect(response.status).toBe(400);
  });

  it("blocks real mode before constructing or accessing the mock booking port", async () => {
    vi.stubEnv("ADAPTER_SHARED_SECRET", "adapter-secret");
    vi.stubEnv("ADAPTER_MODE", "real");
    vi.stubEnv("TMS_MODE", "real");
    const response = await POST(new Request("http://localhost/api/tms/loads/book", {
      method: "POST",
      body: JSON.stringify({ loadId: "LOAD-1002", mc: "demo-mc", agreedRate: 2900 }),
      headers: { "content-type": "application/json", "x-adapter-api-key": "adapter-secret" },
    }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toMatchObject({ ok: false, error: { code: "REAL_BOOKING_DISABLED" }, meta: { requestId: expect.any(String) } });
  });
});
