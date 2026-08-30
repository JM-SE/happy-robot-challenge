import { describe, expect, it } from "vitest";
import { GET, OPTIONS, POST } from "../../app/api/health/route";

describe("runtime health contract", () => {
  it("returns minimal liveness without configuration or external IO", async () => {
    const response = GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("rejects unsupported methods with a stable response", async () => {
    for (const response of [POST(), OPTIONS()]) {
      expect(response.status).toBe(405);
      expect(response.headers.get("allow")).toBe("GET");
      expect(await response.json()).toEqual({ error: { code: "METHOD_NOT_ALLOWED", message: "Method is not allowed." } });
    }
  });
});
