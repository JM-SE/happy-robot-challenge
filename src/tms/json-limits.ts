import {
  MAX_HTTP_JSON_ARRAY_ITEMS,
  MAX_HTTP_JSON_DEPTH,
  MAX_HTTP_JSON_NUMBER_BYTES,
  MAX_HTTP_JSON_OBJECT_KEYS,
  MAX_HTTP_JSON_STRING_BYTES,
} from "./limits";

export interface JsonLimits {
  readonly maxDepth: number;
  readonly maxObjectKeys: number;
  readonly maxArrayItems: number;
  readonly maxStringBytes: number;
  readonly maxNumberBytes: number;
}

export const DEFAULT_JSON_LIMITS: JsonLimits = {
  maxDepth: MAX_HTTP_JSON_DEPTH,
  maxObjectKeys: MAX_HTTP_JSON_OBJECT_KEYS,
  maxArrayItems: MAX_HTTP_JSON_ARRAY_ITEMS,
  maxStringBytes: MAX_HTTP_JSON_STRING_BYTES,
  maxNumberBytes: MAX_HTTP_JSON_NUMBER_BYTES,
};

export const DANGEROUS_JSON_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export class JsonLimitError extends Error {
  readonly code = "JSON_LIMIT_EXCEEDED" as const;
  constructor(message = "JSON structure exceeds the permitted limits.") {
    super(message);
    this.name = "JsonLimitError";
  }
}

const utf8 = new TextEncoder();

/** Pure, bounded structural validation. It never includes input in its errors. */
export function validateJsonLimits(value: unknown, limits: JsonLimits = DEFAULT_JSON_LIMITS): void {
  const visit = (current: unknown, depth: number): void => {
    if (depth > limits.maxDepth) throw new JsonLimitError();
    if (typeof current === "string") {
      if (utf8.encode(current).byteLength > limits.maxStringBytes) throw new JsonLimitError();
      return;
    }
    if (typeof current === "number") {
      if (!Number.isFinite(current) || Math.abs(current).toString().length > limits.maxNumberBytes) throw new JsonLimitError();
      return;
    }
    if (current === null || typeof current === "boolean") return;
    if (Array.isArray(current)) {
      if (current.length > limits.maxArrayItems) throw new JsonLimitError();
      for (const item of current) visit(item, depth + 1);
      return;
    }
    if (typeof current !== "object") throw new JsonLimitError();
    const prototype = Object.getPrototypeOf(current);
    if (prototype !== Object.prototype && prototype !== null) throw new JsonLimitError();
    const keys = Object.keys(current);
    if (keys.length > limits.maxObjectKeys || keys.some((key) => DANGEROUS_JSON_KEYS.has(key))) throw new JsonLimitError();
    for (const key of keys) visit((current as Record<string, unknown>)[key], depth + 1);
  };
  visit(value, 0);
}

export function assertJsonLimits(value: unknown, limits?: JsonLimits): true {
  validateJsonLimits(value, limits);
  return true;
}
