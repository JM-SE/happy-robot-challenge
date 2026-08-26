import { afterEach, describe, expect, it } from "vitest";
import { POST } from "../../app/api/tms/loads/book/route";
import { createMockLtmsServer } from "../../mock/ltms-server";

function configure(host: string, port: number, token = "test-token"): void {
  process.env.TMS_HOST = host;
  process.env.TMS_PORT = String(port);
  process.env.TMS_AUTH_TOKEN = token;
  process.env.TMS_CONNECT_TIMEOUT_MS = "1000";
  process.env.TMS_RESPONSE_TIMEOUT_MS = "1000";
}

describe("POST /api/tms/loads/book", () => {
  let server: ReturnType<typeof createMockLtmsServer> | undefined;

  afterEach(async () => {
    await server?.stop();
    server = undefined;
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
});
