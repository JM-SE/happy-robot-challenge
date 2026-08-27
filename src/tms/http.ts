import { isTmsAdapterError, TmsValidationError, type TmsAdapterError } from "./errors";

export function json(body: unknown, status: number): Response {
  return Response.json(body, { status });
}

const HTTP_STATUS_BY_ERROR_TYPE: Record<string, number> = {
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

  return json({
    ok: false,
    error: {
      type: error.type,
      code: error.code,
      message: getPublicMessage(error),
      retryable: error.retryable,
    },
  }, getHttpStatus(error));
}

export function invalidJsonResponse(): Response {
  return errorResponse(new TmsValidationError("Request body must be valid JSON."));
}
