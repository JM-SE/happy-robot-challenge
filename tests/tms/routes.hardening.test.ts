import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as echo } from "../../app/api/tms/echo/route";
import { POST as search } from "../../app/api/tms/loads/search/route";
import { POST as detail } from "../../app/api/tms/loads/detail/route";
import { POST as book } from "../../app/api/tms/loads/book/route";
import { TmsAdapterError, TmsConfigurationError, TmsRemoteError, TmsTimeoutError, TmsValidationError } from "../../src/tms/errors";
import { errorResponse } from "../../src/tms/http";
import { createMockLtmsServer } from "../../mock/ltms-server";

const jsonRequest = (path: string, body: string): Request => new Request(`http://localhost${path}`, {
  method: "POST",
  body,
  headers: { "content-type": "application/json", "x-adapter-api-key": "adapter-secret" },
});

function configureTms(host: string, port: number): void {
  vi.stubEnv("TMS_HOST", host);
  vi.stubEnv("TMS_PORT", String(port));
  vi.stubEnv("TMS_AUTH_TOKEN", "route-secret");
  vi.stubEnv("TMS_CONNECT_TIMEOUT_MS", "1000");
  vi.stubEnv("TMS_RESPONSE_TIMEOUT_MS", "1000");
  vi.stubEnv("TMS_MAX_FRAME_BYTES", "4096");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

beforeEach(() => {
  vi.stubEnv("ADAPTER_SHARED_SECRET", "adapter-secret");
});

describe("HTTP error contract", () => {
  it.each([
    ["AUTH_FAILED", 401],
    ["UNKNOWN_LOAD", 404],
    ["MISSING_FIELD", 400],
    ["ALREADY_BOOKED", 409],
    ["INVALID_RATE", 422],
    ["SERVER_ERROR", 502],
    ["NEW_REMOTE_CODE", 502],
  ] as const)("maps remote code %s to status %d with a safe envelope", (code, status) => {
    const response = errorResponse(new TmsRemoteError(code, "token=private MAX_BUY=2300"));
    expect(response.status).toBe(status);
    return response.json().then((body) => {
      expect(body).toEqual({
        ok: false,
        error: {
          type: "TMS_REMOTE",
          code,
          message: `The TMS rejected the request (${code}).`,
          retryable: code === "SERVER_ERROR",
        },
      });
      expect(JSON.stringify(body)).not.toContain("private");
      expect(JSON.stringify(body)).not.toContain("MAX_BUY");
    });
  });

  it("uses stable statuses/messages for timeout, protocol, connection, validation, and unknown errors", async () => {
    const cases: Array<[unknown, number, string | undefined, string]> = [
      [new TmsTimeoutError("RESPONSE_TIMEOUT"), 504, "The TMS did not respond within the configured timeout.", ""],
      [new TmsConfigurationError("configuration contains a secret"), 503, undefined, "secret"],
      [new TmsAdapterError({ type: "TMS_PROTOCOL", code: "PROTOCOL_ERROR", message: "wire secret", retryable: false, stage: "parse" }), 502, undefined, "wire secret"],
      [new TmsAdapterError({ type: "TMS_CONNECTION", code: "CONNECTION_ERROR", message: "socket secret", retryable: true, stage: "response" }), 502, undefined, "socket secret"],
      [new TmsValidationError("invalid input"), 400, "invalid input", ""],
      [new Error("stack and database secret"), 500, "An internal error occurred.", "stack"],
    ];
    for (const [error, status, message, forbidden] of cases) {
      const response = errorResponse(error);
      expect(response.status).toBe(status);
      const body = await response.json();
      if (message) expect(body.error.message).toBe(message);
      if (forbidden) expect(JSON.stringify(body)).not.toContain(forbidden);
      expect(JSON.stringify(body)).not.toContain("database");
    }
  });

  it("sanitizes unknown remote codes without collapsing them to a generic code", async () => {
    const response = errorResponse(new TmsRemoteError("NEW-CODE", "full remote wire"));
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.error.code).toBe("NEW_CODE");
    expect(body.error.message).toBe("The TMS rejected the request (NEW_CODE).");
    expect(JSON.stringify(body)).not.toContain("full remote wire");
  });
});

describe("route validation and fault mapping", () => {
  it.each([
    [echo, "/api/tms/echo"],
    [search, "/api/tms/loads/search"],
    [detail, "/api/tms/loads/detail"],
    [book, "/api/tms/loads/book"],
  ] as const)("returns 400 for invalid JSON before opening a TMS socket (%s)", async (route, path) => {
    const response = await route(jsonRequest(path, "{not-json"));
    expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ ok: false, error: { code: "MALFORMED_JSON" }, meta: { requestId: expect.any(String) } });
  });

  it("rejects unsafe echo input and never exposes the auth token", async () => {
    const response = await echo(jsonRequest("/api/tms/echo", JSON.stringify({ message: "secret|token" })));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(JSON.stringify(body)).not.toContain("route-secret");
    expect(JSON.stringify(body)).not.toContain("secret|token");
  });

  it("rejects unknown echo fields instead of forwarding them upstream", async () => {
    const response = await echo(jsonRequest("/api/tms/echo", JSON.stringify({ message: "hello", unexpected: "field" })));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR" },
    });
  });

  it("maps a real remote fault through a route without exposing remote diagnostics", async () => {
    const server = createMockLtmsServer({
      port: 0,
      authToken: "route-secret",
      fault: { kind: "remote-error", code: "AUTH_FAILED" },
    });
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    try {
      const address = await server.start();
      configureTms(address.host, address.port);
      const response = await echo(jsonRequest("/api/tms/echo", JSON.stringify({ message: "hello" })));
      expect(response.status).toBe(502);
      const body = await response.json();
      expect(body).toMatchObject({
        ok: false,
        error: { code: "TMS_AUTH_FAILED", message: "The TMS rejected the request authorization.", retryable: false },
        meta: { requestId: expect.any(String) },
      });
      expect(JSON.stringify(body)).not.toContain("route-secret");
      expect(JSON.stringify(log.mock.calls)).not.toContain("route-secret");
    } finally {
      await server.stop();
    }
  });
});
