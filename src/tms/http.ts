import { isTmsAdapterError, TmsValidationError, type TmsAdapterError } from "./errors";
import { MAX_HTTP_BODY_BYTES } from "./limits";
import { validateJsonLimits } from "./json-limits";

export function json(body: unknown, status: number): Response {
  return Response.json(body, { status });
}

const HTTP_STATUS_BY_ERROR_TYPE: Record<string, number> = {
  TMS_AUTHORIZATION: 403,
  TMS_RATE_LIMIT: 429,
  TMS_CONCURRENCY: 503,
  TMS_VALIDATION: 400,
  TMS_UPSTREAM: 502,
  TMS_CONFIGURATION: 503,
  TMS_TIMEOUT: 504,
  TMS_REMOTE: 502,
  TMS_PROTOCOL: 502,
  TMS_RESPONSE_INCOMPLETE: 502,
  TMS_CONNECTION: 502,
};

const FIXED_PUBLIC_MESSAGES: Record<string, string> = {
  TMS_AUTHORIZATION: "The caller is not authorized for this operation.",
  TMS_RATE_LIMIT: "The request rate limit was exceeded.",
  TMS_CONCURRENCY: "The service is handling its maximum number of requests.",
  TMS_CONFIGURATION: "The TMS configuration is unavailable.",
  TMS_TIMEOUT: "The TMS did not respond within the configured timeout.",
  TMS_PROTOCOL: "The TMS response was invalid.",
  TMS_RESPONSE_INCOMPLETE: "The TMS connection closed before a complete response was received.",
  TMS_CONNECTION: "The TMS connection failed.",
  TMS_UPSTREAM: "The TMS returned an invalid response.",
};

function getHttpStatus(error: TmsAdapterError): number {
  if (error.type === "TMS_REMOTE") {
    const remoteStatus: Record<string, number> = {
      AUTH_FAILED: 401,
      UNKNOWN_LOAD: 404,
      MISSING_FIELD: 400,
      ALREADY_BOOKED: 409,
      INVALID_RATE: 422,
      SERVER_ERROR: 502,
    };
    return remoteStatus[error.code] ?? HTTP_STATUS_BY_ERROR_TYPE[error.type] ?? 500;
  }
  return HTTP_STATUS_BY_ERROR_TYPE[error.type] ?? 500;
}

function getPublicMessage(error: TmsAdapterError): string {
  const fixedMessage = FIXED_PUBLIC_MESSAGES[error.type];
  if (fixedMessage) return fixedMessage;
  if (error.type === "TMS_REMOTE") return `The TMS rejected the request (${error.code}).`;
  return error.message;
}

export function errorResponse(error: unknown): Response {
  if (!isTmsAdapterError(error)) {
    return json({ ok: false, error: { type: "INTERNAL_ERROR", code: "INTERNAL_ERROR", message: "An internal error occurred.", retryable: false } }, 500);
  }

  const response = json({
    ok: false,
    error: {
      type: error.type,
      code: error.code,
      message: getPublicMessage(error),
      retryable: error.retryable,
    },
  }, getHttpStatus(error));
  if ((error.type === "TMS_RATE_LIMIT" || error.type === "TMS_CONCURRENCY") && error.metadata.retryAfterMs !== undefined && Number.isFinite(error.metadata.retryAfterMs)) {
    response.headers.set("Retry-After", String(Math.max(1, Math.ceil(error.metadata.retryAfterMs / 1000))));
  }
  return response;
}

export function invalidJsonResponse(): Response {
  return errorResponse(new TmsValidationError("Request body must be valid JSON."));
}

export async function readJsonBody(request: Request): Promise<unknown> {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const parsedLength = Number(contentLength);
    if (!Number.isInteger(parsedLength) || parsedLength < 0 || parsedLength > MAX_HTTP_BODY_BYTES) {
      throw new TmsValidationError("Request body is too large.");
    }
  }

  if (!request.body) throw new TmsValidationError("Request body must be valid JSON.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_HTTP_BODY_BYTES) {
        await reader.cancel();
        throw new TmsValidationError("Request body is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new TmsValidationError("Request body must be valid UTF-8 JSON.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new TmsValidationError("Request body must be valid JSON.");
  }
  try {
    validateJsonLimits(parsed);
  } catch {
    throw new TmsValidationError("Request JSON exceeds the permitted structure limits.");
  }
  return parsed;
}
