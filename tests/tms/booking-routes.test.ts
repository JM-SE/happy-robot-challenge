import { afterEach, describe, expect, it } from "vitest";
import { POST } from "../../app/api/tms/loads/book/route";
import { createMockLtmsServer } from "../../mock/ltms-server";

describe("POST /api/tms/loads/book", () => {
  let server: ReturnType<typeof createMockLtmsServer> | undefined;

  afterEach(async () => {
    await server?.stop();
    server = undefined;
  });

  it("denies the public mutation route before connecting or mutating state", async () => {
    server = createMockLtmsServer({ port: 0, authToken: "test-token" });
    const address = await server.start();
    const response = await POST(new Request(`http://${address.host}:${address.port}/api/tms/loads/book`, {
      method: "POST",
      body: JSON.stringify({ loadId: "LOAD-1001", mcNumber: "12345", agreedRate: 2200 }),
      headers: { "content-type": "application/json" },
    }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toMatchObject({ type: "TMS_AUTHORIZATION", code: "CALLER_NOT_AUTHORIZED" });
    expect(server.requestCount).toBe(0);
  });

  it("rejects malformed JSON at the request boundary", async () => {
    const response = await POST(new Request("http://localhost/api/tms/loads/book", {
      method: "POST",
      body: "not-json",
      headers: { "content-type": "application/json" },
    }));

    expect(response.status).toBe(400);
  });
});
