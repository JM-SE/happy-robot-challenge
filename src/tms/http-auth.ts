import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/** Adapter credentials are intentionally independent from TMS credentials. */
export function getAdapterSecret(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const value = env.ADAPTER_SHARED_SECRET;
  return value && value.trim() ? value : undefined;
}

export function isAdapterAuthorized(candidate: string | null, env: NodeJS.ProcessEnv = process.env): boolean {
  const secret = getAdapterSecret(env);
  if (!secret || candidate === null) return false;
  // Comparing fixed-size HMAC digests avoids an observable length branch while
  // retaining timingSafeEqual for the actual comparison.
  const expected = createHmac("sha256", "adapter-key-comparison").update(secret).digest();
  const provided = createHmac("sha256", "adapter-key-comparison").update(candidate).digest();
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}
