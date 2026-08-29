import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as book } from "../../app/api/tms/loads/book/route";
import { isAdapterAuthorized } from "../../src/tms/http-auth";
import { mapPublicError } from "../../src/tms/http-contract";
import { parseHttpSearch } from "../../src/tms/http-dto";
import { TmsRemoteError } from "../../src/tms/errors";

afterEach(() => vi.unstubAllEnvs());

const request = (body: string, headers: Record<string, string> = {}) => new Request("http://localhost/api/tms/loads/book", {
  method: "POST", body, headers: { "content-type": "application/json", "x-adapter-api-key": "contract-secret", ...headers },
});

describe("Phase 3A HTTP boundary", () => {
  it("uses the server secret and does not authorize a request ID", () => {
    expect(isAdapterAuthorized("contract-secret", { NODE_ENV: "test", ADAPTER_SHARED_SECRET: "contract-secret" })).toBe(true);
    expect(isAdapterAuthorized("wrong", { NODE_ENV: "test", ADAPTER_SHARED_SECRET: "contract-secret" })).toBe(false);
    expect(isAdapterAuthorized("contract-secret", { NODE_ENV: "test" })).toBe(false);
  });

  it("returns a stable authenticated booking denial with correlation metadata", async () => {
    vi.stubEnv("ADAPTER_SHARED_SECRET", "contract-secret");
    const response = await book(request(JSON.stringify({ loadId: "L-1", mc: "MC-1", agreedRate: 100 })));
    const body = await response.json();
    expect(response.status).toBe(403);
    expect(body.error).toEqual({ code: "POLICY_DENIED", message: "The operation is not permitted.", retryable: false });
    expect(body.meta.requestId).toBeTruthy();
    expect(response.headers.get("x-request-id")).toBe(body.meta.requestId);
  });

  it("does not distinguish missing adapter credentials from invalid credentials", async () => {
    vi.stubEnv("ADAPTER_SHARED_SECRET", "contract-secret");
    const missing = await book(new Request("http://localhost/api/tms/loads/book", { method: "POST", body: "{}", headers: { "content-type": "application/json" } }));
    const wrong = await book(request("{}", { "x-adapter-api-key": "wrong" }));
    expect(missing.status).toBe(401);
    expect(await missing.json()).toMatchObject({ error: { code: "ADAPTER_UNAUTHORIZED" } });
    expect(await wrong.json()).toMatchObject({ error: { code: "ADAPTER_UNAUTHORIZED" } });
  });

  it("keeps TMS authentication failures outside adapter 401", () => {
    expect(mapPublicError(new TmsRemoteError("AUTH_FAILED"))).toMatchObject({ status: 502, code: "TMS_AUTH_FAILED" });
  });

  it("accepts only the closed Phase 3A search request", () => {
    expect(parseHttpSearch({ originState: "tx", equipmentType: " van ", maxResults: 2 })).toEqual({ originState: "TX", equipmentType: "VAN", maxResults: 2 });
    expect(() => parseHttpSearch({ originState: "TX", pickupDate: "2026-01-01" })).toThrow();
  });
});
