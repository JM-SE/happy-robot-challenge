import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as echo } from "../../app/api/tms/echo/route";
import { POST as book } from "../../app/api/tms/loads/book/route";
import { createMockLtmsServer } from "../../mock/ltms-server";

describe("real read-only HTTP composition", () => {
  let server: ReturnType<typeof createMockLtmsServer> | undefined;

  afterEach(async () => {
    await server?.stop();
    server = undefined;
    vi.unstubAllEnvs();
  });

  it("connects read-only echo through the approved plaintext TCP seam", async () => {
    server = createMockLtmsServer({ port: 0, authToken: "tms-secret" });
    const address = await server.start();
    const pin = `${address.host}:${address.port}`;
    vi.stubEnv("ADAPTER_MODE", "real");
    vi.stubEnv("ADAPTER_SHARED_SECRET", "adapter-secret");
    vi.stubEnv("REAL_BOOKING_ENABLED", "false");
    vi.stubEnv("TMS_MODE", "real");
    vi.stubEnv("TMS_ENV", "non-production");
    vi.stubEnv("TMS_REAL_ENABLED", "true");
    vi.stubEnv("TMS_HOST", address.host);
    vi.stubEnv("TMS_PORT", String(address.port));
    vi.stubEnv("TMS_AUTH_TOKEN", "tms-secret");
    vi.stubEnv("TMS_CONNECT_TIMEOUT_MS", "1000");
    vi.stubEnv("TMS_RESPONSE_TIMEOUT_MS", "1000");
    vi.stubEnv("TMS_REAL_TARGET_PIN", pin);
    vi.stubEnv("TMS_REAL_TARGET_ALLOWLIST", pin);
    vi.stubEnv("TMS_REAL_TRANSPORT_APPROVED", "true");
    vi.stubEnv("TMS_REAL_AUTHORITY_HOST", address.host);
    vi.stubEnv("TMS_REAL_AUTHORITY_PORT", String(address.port));

    const response = await echo(new Request("http://localhost/api/tms/echo", {
      method: "POST",
      body: JSON.stringify({ message: "railway-read-only" }),
      headers: { "content-type": "application/json", "x-adapter-api-key": "adapter-secret" },
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, data: { message: "railway-read-only" } });
    expect(server.requestCount).toBe(1);
  });

  it("keeps booking denied before the TMS dependency in real mode", async () => {
    vi.stubEnv("ADAPTER_MODE", "real");
    vi.stubEnv("ADAPTER_SHARED_SECRET", "adapter-secret");
    vi.stubEnv("TMS_MODE", "real");
    const response = await book(new Request("http://localhost/api/tms/loads/book", {
      method: "POST",
      body: JSON.stringify({ loadId: "LOAD-1001", mc: "MC-1", agreedRate: 2000 }),
      headers: { "content-type": "application/json", "x-adapter-api-key": "adapter-secret" },
    }));

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "REAL_BOOKING_DISABLED" } });
  });
});
