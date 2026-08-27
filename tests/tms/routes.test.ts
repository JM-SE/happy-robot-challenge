import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../../app/api/tms/echo/route";
import { createMockLtmsServer } from "../../mock/ltms-server";

describe("POST /api/tms/echo", () => {
  let server: ReturnType<typeof createMockLtmsServer> | undefined;

  afterEach(async () => {
    await server?.stop();
    server = undefined;
    vi.unstubAllEnvs();
  });

  it("returns normalized echo data and never returns the auth token", async () => {
    server = createMockLtmsServer({ port: 0, authToken: "test-secret" });
    const address = await server.start();
    vi.stubEnv("TMS_HOST", address.host);
    vi.stubEnv("TMS_PORT", String(address.port));
    vi.stubEnv("TMS_AUTH_TOKEN", "test-secret");
    vi.stubEnv("TMS_CONNECT_TIMEOUT_MS", "1000");
    vi.stubEnv("TMS_RESPONSE_TIMEOUT_MS", "1000");
    vi.stubEnv("TMS_MAX_FRAME_BYTES", "4096");

    const response = await POST(new Request("http://localhost/api/tms/echo", {
      method: "POST", body: JSON.stringify({ message: "hello" }), headers: { "content-type": "application/json" },
    }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true, data: { message: "hello", fieldCount: 3 } });
    expect(JSON.stringify(body)).not.toContain("test-secret");
  });

  it("validates input without opening a socket", async () => {
    const response = await POST(new Request("http://localhost/api/tms/echo", {
      method: "POST", body: JSON.stringify({ message: "bad|message" }), headers: { "content-type": "application/json" },
    }));
    expect(response.status).toBe(400);
    expect((await response.json()).ok).toBe(false);
  });
});
