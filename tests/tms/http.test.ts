import { describe, expect, it } from "vitest";
import { readJsonBody } from "../../src/tms/http";

describe("bounded HTTP JSON body reader", () => {
  it("parses a valid JSON request body", async () => {
    const body = await readJsonBody(new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ originState: "TX" }),
      headers: { "content-type": "application/json" },
    }));

    expect(body).toEqual({ originState: "TX" });
  });

  it("rejects invalid JSON", async () => {
    await expect(readJsonBody(new Request("http://localhost", { method: "POST", body: "{" }))).rejects.toThrow(/valid JSON/i);
  });

  it("rejects a body over the configured limit", async () => {
    const oversized = "x".repeat(32 * 1024);
    await expect(readJsonBody(new Request("http://localhost", { method: "POST", body: JSON.stringify({ oversized }) }))).rejects.toThrow(/too large/i);
  });
});
