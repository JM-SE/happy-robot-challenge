import { afterEach, describe, expect, it, vi } from "vitest";
import { assertBookingCallerAuthorized } from "../../src/tms/caller-authorization";
import { errorResponse } from "../../src/tms/http";
import { TmsRateLimitError } from "../../src/tms/errors";
import { admitTmsRequest } from "../../src/tms/http-controls";
import { BoundedTokenBucketRateLimiter, RejectingSemaphore } from "../../src/tms/resource-controls";

afterEach(() => vi.unstubAllEnvs());

describe("HTTP/TMS controls", () => {
  it("rejects saturated admission and releases a successful permit", () => {
    const semaphore = new RejectingSemaphore(1);
    const rateLimiter = new BoundedTokenBucketRateLimiter({ capacity: 1, refillPerSecond: 1 });
    const admission = admitTmsRequest({ semaphore, rateLimiter, deadlineMs: 1000, rateKey: "one" });
    expect(semaphore.inFlight).toBe(1);
    expect(() => admitTmsRequest({ semaphore, rateLimiter, deadlineMs: 1000, rateKey: "two" })).toThrow(/maximum number/i);
    admission.release();
    admission.budget.dispose();
    expect(semaphore.inFlight).toBe(0);
  });

  it("emits Retry-After only for a bounded rate-limit error", async () => {
    const response = errorResponse(new TmsRateLimitError(1500));
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("2");
  });

  it("does not authorize booking from arbitrary caller headers", () => {
    vi.stubEnv("NODE_ENV", "test");
    expect(() => assertBookingCallerAuthorized()).toThrow(/not authorized/i);
  });
});
