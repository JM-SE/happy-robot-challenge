import { isTmsAdapterError, TmsConfigurationError, TmsRemoteError, TmsValidationError } from "./errors";
import { MAX_HTTP_BODY_BYTES } from "./limits";
import { isAdapterAuthorized } from "./http-auth";
import { createRequestContext, requestContextHeaders, type RequestContext } from "./request-context";
import { readJsonBody } from "./http";

export const ADAPTER_API_KEY_HEADER = "x-adapter-api-key";
export const CONTENT_TYPE_HEADER = "content-type";

export class HttpContractError extends Error {
  constructor(readonly status: number, readonly code: string, readonly publicMessage: string, readonly retryable = false) {
    super(publicMessage);
  }
}

const PUBLIC_MESSAGES: Record<string, string> = {
  ADAPTER_UNAUTHORIZED: "Adapter authentication failed.",
  MALFORMED_JSON: "Request body must be valid JSON.",
  VALIDATION_ERROR: "The request is invalid.",
  REQUEST_TOO_LARGE: "Request body is too large.",
  UNSUPPORTED_MEDIA_TYPE: "Content-Type must be application/json.",
  METHOD_NOT_ALLOWED: "Method is not allowed.",
  CONFIGURATION_UNAVAILABLE: "The service configuration is unavailable.",
  REAL_BOOKING_DISABLED: "Booking is disabled.",
  LOAD_NOT_FOUND: "Load was not found.",
  TMS_AUTH_FAILED: "The TMS rejected the request authorization.",
  UPSTREAM_ERROR: "The upstream service returned an error.",
  PROTOCOL_ERROR: "The upstream response was invalid.",
  SERVICE_UNAVAILABLE: "The service is temporarily unavailable.",
  TMS_TIMEOUT: "The upstream service timed out.",
};

export function successResponse(data: unknown, context: RequestContext): Response {
  return Response.json({ ok: true, data, meta: { requestId: context.requestId } }, { status: 200, headers: requestContextHeaders(context) });
}

export function publicErrorResponse(error: unknown, context: RequestContext, allow?: string): Response {
  const mapped = mapPublicError(error);
  const headers = requestContextHeaders(context);
  if (allow) headers.set("Allow", allow);
  return Response.json({ ok: false, error: { code: mapped.code, message: mapped.message, retryable: mapped.retryable }, meta: { requestId: context.requestId } }, { status: mapped.status, headers });
}

export function mapPublicError(error: unknown): { status: number; code: string; message: string; retryable: boolean } {
  if (error instanceof HttpContractError) return { status: error.status, code: error.code, message: error.publicMessage, retryable: error.retryable };
  if (error instanceof TmsRemoteError) {
    if (error.remoteCode === "UNKNOWN_LOAD") return { status: 404, code: "LOAD_NOT_FOUND", message: PUBLIC_MESSAGES.LOAD_NOT_FOUND!, retryable: false };
    if (error.remoteCode === "AUTH_FAILED") return { status: 502, code: "TMS_AUTH_FAILED", message: PUBLIC_MESSAGES.TMS_AUTH_FAILED!, retryable: false };
    return { status: 502, code: "UPSTREAM_ERROR", message: PUBLIC_MESSAGES.UPSTREAM_ERROR!, retryable: false };
  }
  if (error instanceof TmsValidationError) {
    const tooLarge = /too large|structure limits/i.test(error.message);
    const malformed = /valid (?:UTF-8 )?JSON/i.test(error.message);
    const code = tooLarge ? "REQUEST_TOO_LARGE" : malformed ? "MALFORMED_JSON" : "VALIDATION_ERROR";
    return { status: tooLarge ? 413 : 400, code, message: PUBLIC_MESSAGES[code] ?? PUBLIC_MESSAGES.VALIDATION_ERROR!, retryable: false };
  }
  if (error instanceof TmsConfigurationError) return { status: 503, code: "CONFIGURATION_UNAVAILABLE", message: PUBLIC_MESSAGES.CONFIGURATION_UNAVAILABLE!, retryable: false };
  if (isTmsAdapterError(error)) {
    const table: Record<string, [number, string]> = { TMS_TIMEOUT: [504, "TMS_TIMEOUT"], TMS_PROTOCOL: [502, "PROTOCOL_ERROR"], TMS_CONCURRENCY: [503, "SERVICE_UNAVAILABLE"], TMS_CONNECTION: [502, "UPSTREAM_ERROR"], TMS_RESPONSE_INCOMPLETE: [502, "UPSTREAM_ERROR"], TMS_UPSTREAM: [502, "UPSTREAM_ERROR"] };
    const [status, code] = table[error.type] ?? [502, "UPSTREAM_ERROR"];
    return { status, code, message: PUBLIC_MESSAGES[code] ?? PUBLIC_MESSAGES.UPSTREAM_ERROR!, retryable: false };
  }
  return { status: 500, code: "UPSTREAM_ERROR", message: PUBLIC_MESSAGES.UPSTREAM_ERROR!, retryable: false };
}

export async function readAdapterRequest(request: Request, context = createRequestContext(request)): Promise<{ context: RequestContext; body: unknown }> {
  if (request.method !== "POST") throw new HttpContractError(405, "METHOD_NOT_ALLOWED", PUBLIC_MESSAGES.METHOD_NOT_ALLOWED!);
  if (context.invalidRequestId) throw new HttpContractError(400, "VALIDATION_ERROR", PUBLIC_MESSAGES.VALIDATION_ERROR!);
  if (!isAdapterAuthorized(request.headers.get(ADAPTER_API_KEY_HEADER))) throw new HttpContractError(401, "ADAPTER_UNAUTHORIZED", PUBLIC_MESSAGES.ADAPTER_UNAUTHORIZED!);
  const contentType = request.headers.get(CONTENT_TYPE_HEADER);
  if (!contentType || !/^application\/json\s*(?:;|$)/i.test(contentType)) throw new HttpContractError(415, "UNSUPPORTED_MEDIA_TYPE", PUBLIC_MESSAGES.UNSUPPORTED_MEDIA_TYPE!);
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_HTTP_BODY_BYTES)) throw new HttpContractError(413, "REQUEST_TOO_LARGE", PUBLIC_MESSAGES.REQUEST_TOO_LARGE!);
  return { context, body: await readJsonBody(request) };
}

export async function handleAdapterRequest(request: Request, handler: (body: unknown, context: RequestContext) => Promise<unknown>): Promise<Response> {
  const context = createRequestContext(request);
  try {
    const input = await readAdapterRequest(request, context);
    return successResponse(await handler(input.body, context), context);
  } catch (error) {
    return publicErrorResponse(error, context, request.method === "POST" ? undefined : "POST");
  }
}
