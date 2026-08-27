import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../../app/api/tms/loads/book/route";
import { createMockLtmsServer } from "../../mock/ltms-server";
import { MOCK_FAULT_SCENARIOS } from "../../mock/scenarios";

function configure(host: string, port: number, token = "test-token", responseTimeoutMs = 1000): void {
  vi.stubEnv("TMS_HOST", host);
  vi.stubEnv("TMS_PORT", String(port));
  vi.stubEnv("TMS_AUTH_TOKEN", token);
  vi.stubEnv("TMS_CONNECT_TIMEOUT_MS", "1000");
  vi.stubEnv("TMS_RESPONSE_TIMEOUT_MS", String(responseTimeoutMs));
}

async function bookingResponse(body: unknown): Promise<{ response: Response; body: Record<string, unknown> }> {
  const response = await POST(new Request("http://localhost/api/tms/loads/book", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  }));
  return { response, body: await response.json() as Record<string, unknown> };
}

describe("POST /api/tms/loads/book", () => {
  let server: ReturnType<typeof createMockLtmsServer> | undefined;

  afterEach(async () => {
    await server?.stop();
    server = undefined;
    vi.unstubAllEnvs();
  });

  it("books once and returns a safe public result", async () => {
    server = createMockLtmsServer({ port: 0, authToken: "test-token" });
    const address = await server.start();
    configure(address.host, address.port);
    const response = await POST(new Request("http://localhost/api/tms/loads/book", {
      method: "POST", body: JSON.stringify({ loadId: "LOAD-1001", mcNumber: "12345", agreedRate: 2200 }),
    }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.booking).toMatchObject({ loadId: "LOAD-1001", mcNumber: "12345", agreedRate: 2200, bookingRef: "BOOK-LOAD-1001" });
    expect(body.data.booking.bookedAt).toMatch(/Z$/);
    expect(JSON.stringify(body)).not.toContain("MAX_BUY");
  });

  it("maps a second booking and invalid rate to conflict/rule errors", async () => {
    server = createMockLtmsServer({ port: 0, authToken: "test-token" });
    const address = await server.start();
    configure(address.host, address.port);
    const body = { loadId: "LOAD-1002", mcNumber: "12345", agreedRate: 2900 };
    expect((await POST(new Request("http://localhost/api/tms/loads/book", { method: "POST", body: JSON.stringify(body) }))).status).toBe(200);
    const second = await POST(new Request("http://localhost/api/tms/loads/book", { method: "POST", body: JSON.stringify(body) }));
    expect(second.status).toBe(409);
    const invalid = await POST(new Request("http://localhost/api/tms/loads/book", {
      method: "POST", body: JSON.stringify({ loadId: "LOAD-1001", mcNumber: "12345", agreedRate: 9999 }),
    }));
    expect(invalid.status).toBe(422);
  });

  it("does not accept mcNum as a public alias", async () => {
    const response = await POST(new Request("http://localhost/api/tms/loads/book", {
      method: "POST", body: JSON.stringify({ loadId: "LOAD-1001", mcNum: "12345", agreedRate: 2200 }),
    }));
    expect(response.status).toBe(400);
  });

  it("maps authentication and unknown-load failures through the booking route", async () => {
    server = createMockLtmsServer({ port: 0, authToken: "server-token" });
    const address = await server.start();
    configure(address.host, address.port);
    const authFailure = await bookingResponse({ loadId: "LOAD-1001", mcNumber: "12345", agreedRate: 2200 });
    expect(authFailure.response.status).toBe(401);
    expect(authFailure.body.error).toMatchObject({ code: "AUTH_FAILED", retryable: false });

    await server.stop();
    server = createMockLtmsServer({ port: 0, authToken: "test-token" });
    const secondAddress = await server.start();
    configure(secondAddress.host, secondAddress.port);
    const unknownLoad = await bookingResponse({ loadId: "LOAD-404", mcNumber: "12345", agreedRate: 2200 });
    expect(unknownLoad.response.status).toBe(404);
    expect(unknownLoad.body.error).toMatchObject({ code: "UNKNOWN_LOAD", retryable: false });
  });

  it("maps server errors and timeouts as non-retryable booking failures", async () => {
    server = createMockLtmsServer({
      port: 0,
      authToken: "test-token",
      bookingServerError: true,
    });
    const address = await server.start();
    configure(address.host, address.port);
    const serverFailure = await bookingResponse({ loadId: "LOAD-1001", mcNumber: "12345", agreedRate: 2200 });
    expect(serverFailure.response.status).toBe(502);
    expect(serverFailure.body.error).toMatchObject({ code: "SERVER_ERROR", retryable: false });

    await server.stop();
    server = createMockLtmsServer({
      port: 0,
      authToken: "test-token",
      fault: MOCK_FAULT_SCENARIOS.NO_RESPONSE,
    });
    const timeoutAddress = await server.start();
    configure(timeoutAddress.host, timeoutAddress.port, "test-token", 50);
    const timeout = await bookingResponse({ loadId: "LOAD-1001", mcNumber: "12345", agreedRate: 2200 });
    expect(timeout.response.status).toBe(504);
    expect(timeout.body.error).toMatchObject({ code: "RESPONSE_TIMEOUT", retryable: false });
  });
});
