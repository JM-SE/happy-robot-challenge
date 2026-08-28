import { MAX_TMS_IN_FLIGHT, MAX_TMS_RATE_KEYS, TMS_RATE_CAPACITY, TMS_RATE_REFILL_PER_SECOND } from "./limits";

export interface RateLimitResult { readonly allowed: boolean; readonly retryAfterMs?: number; }
export interface RateLimitBucket { readonly tokens: number; readonly updatedAt: number; readonly lastUsedAt: number; }
interface Bucket { tokens: number; updatedAt: number; lastUsedAt: number; }

/** Adapter seam for a future shared/distributed limiter; local mode is bounded. */
export interface RateLimitStore {
  get(key: string): Promise<RateLimitBucket | undefined>;
  set(key: string, bucket: RateLimitBucket): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface RateLimiterOptions { readonly capacity?: number; readonly refillPerSecond?: number; readonly maxKeys?: number; readonly now?: () => number; }

export class BoundedTokenBucketRateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private readonly capacity: number;
  private readonly refillPerSecond: number;
  private readonly maxKeys: number;
  private readonly now: () => number;
  constructor(options: RateLimiterOptions = {}) {
    this.capacity = options.capacity ?? TMS_RATE_CAPACITY;
    this.refillPerSecond = options.refillPerSecond ?? TMS_RATE_REFILL_PER_SECOND;
    this.maxKeys = options.maxKeys ?? MAX_TMS_RATE_KEYS;
    this.now = options.now ?? Date.now;
    if (!Number.isFinite(this.capacity) || this.capacity < 1 || !Number.isFinite(this.refillPerSecond) || this.refillPerSecond <= 0 || !Number.isInteger(this.maxKeys) || this.maxKeys < 1) {
      throw new RangeError("Invalid rate limiter bounds.");
    }
  }
  consume(key: string, cost = 1): RateLimitResult {
    if (!Number.isInteger(cost) || cost < 1 || cost > this.capacity) return { allowed: false, retryAfterMs: Number.POSITIVE_INFINITY };
    const now = this.now();
    let bucket = this.buckets.get(key);
    if (!bucket) {
      if (this.buckets.size >= this.maxKeys) this.evictOldest();
      bucket = { tokens: this.capacity, updatedAt: now, lastUsedAt: now };
      this.buckets.set(key, bucket);
    }
    bucket.tokens = Math.min(this.capacity, bucket.tokens + Math.max(0, now - bucket.updatedAt) * this.refillPerSecond / 1000);
    bucket.updatedAt = now;
    bucket.lastUsedAt = now;
    if (bucket.tokens < cost) return { allowed: false, retryAfterMs: Math.ceil((cost - bucket.tokens) * 1000 / this.refillPerSecond) };
    bucket.tokens -= cost;
    return { allowed: true };
  }
  get size(): number { return this.buckets.size; }
  private evictOldest(): void {
    let oldest: string | undefined;
    let oldestAt = Number.POSITIVE_INFINITY;
    for (const [key, bucket] of this.buckets) if (bucket.lastUsedAt < oldestAt) { oldest = key; oldestAt = bucket.lastUsedAt; }
    if (oldest !== undefined) this.buckets.delete(oldest);
  }
}

export class RejectingSemaphore {
  private available: number;
  constructor(private readonly capacity = MAX_TMS_IN_FLIGHT) {
    if (!Number.isInteger(capacity) || capacity < 1) throw new RangeError("Semaphore capacity must be positive.");
    this.available = capacity;
  }
  tryAcquire(): (() => void) | undefined {
    if (this.available === 0) return undefined;
    this.available -= 1;
    let released = false;
    return () => { if (!released) { released = true; this.available += 1; } };
  }
  get inFlight(): number { return this.capacity - this.available; }
}
