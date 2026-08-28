import { describe, expect, it, vi } from "vitest";
import { DeadlineBudget, DeadlineExceededError } from "../../src/tms/deadline";
import { JsonLimitError, validateJsonLimits } from "../../src/tms/json-limits";
import { BoundedTokenBucketRateLimiter, RejectingSemaphore } from "../../src/tms/resource-controls";

describe("TMS safety primitives", () => {
  it("rejects structural JSON limits and dangerous keys", () => {
    expect(() => validateJsonLimits({ nested: { value: { too: "deep" } } }, { maxDepth: 1, maxObjectKeys: 10, maxArrayItems: 10, maxStringBytes: 20, maxNumberBytes: 10 })).toThrow(JsonLimitError);
    expect(() => validateJsonLimits(JSON.parse('{"constructor":{}}'))).toThrow(JsonLimitError);
    expect(() => validateJsonLimits({ value: "🙂" }, { maxDepth: 4, maxObjectKeys: 4, maxArrayItems: 4, maxStringBytes: 3, maxNumberBytes: 10 })).toThrow(JsonLimitError);
  });

  it("bounds rate-limit keys and rejects over-capacity requests", () => {
    let now = 0;
    const limiter = new BoundedTokenBucketRateLimiter({ capacity: 1, refillPerSecond: 1, maxKeys: 2, now: () => now });
    expect(limiter.consume("a").allowed).toBe(true);
    expect(limiter.consume("a").allowed).toBe(false);
    expect(limiter.consume("b").allowed).toBe(true);
    expect(limiter.consume("c").allowed).toBe(true);
    expect(limiter.size).toBe(2);
    now = 1_000;
    expect(limiter.consume("a").allowed).toBe(true);
  });

  it("does not queue semaphore callers and releases idempotently", () => {
    const semaphore = new RejectingSemaphore(1);
    const release = semaphore.tryAcquire();
    expect(release).toBeDefined();
    expect(semaphore.tryAcquire()).toBeUndefined();
    release?.();
    release?.();
    expect(semaphore.inFlight).toBe(0);
  });

  it("aborts an expired deadline and cleans its timer on completion", async () => {
    vi.useFakeTimers();
    const budget = new DeadlineBudget(100);
    const operation = budget.run(async (signal, remainingMs) => {
      expect(remainingMs).toBeGreaterThan(0);
      await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
      throw new DeadlineExceededError();
    });
    const observed = operation.then(() => undefined, (error: unknown) => error);
    await vi.advanceTimersByTimeAsync(100);
    expect(await observed).toBeInstanceOf(DeadlineExceededError);
    expect(budget.signal.aborted).toBe(true);
    budget.dispose();
    vi.useRealTimers();
  });
});
