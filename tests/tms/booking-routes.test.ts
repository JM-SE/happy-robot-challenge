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

  it("denies the public mutation route before connecting or mutating state", async () => {
    server = createMockLtmsServer({ port: 0, authToken: "test-token" });
    const address = await server.start();
    vi.stubEnv("ADAPTER_SHARED_SECRET", "adapter-secret");
    const response = await POST(new Request(`http://${address.host}:${address.port}/api/tms/loads/book`, {
      method: "POST",
      body: JSON.stringify({ loadId: "LOAD-1001", mc: "12345", agreedRate: 2200 }),
      headers: { "content-type": "application/json", "x-adapter-api-key": "adapter-secret" },
    }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toMatchObject({ ok: false, error: { code: "POLICY_DENIED", retryable: false }, meta: { requestId: expect.any(String) } });
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
});
