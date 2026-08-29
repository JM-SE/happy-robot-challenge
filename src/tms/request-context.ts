import { randomUUID } from "node:crypto";
import { MAX_HTTP_REQUEST_ID_LENGTH } from "./limits";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,64}$/;

export interface RequestContext {
  readonly requestId: string;
  readonly suppliedRequestId: boolean;
  readonly invalidRequestId: boolean;
}

export function createRequestContext(request: Request): RequestContext {
  const supplied = request.headers.get("x-request-id");
  return {
    requestId: supplied && REQUEST_ID_PATTERN.test(supplied) && supplied.length <= MAX_HTTP_REQUEST_ID_LENGTH ? supplied : randomUUID(),
    suppliedRequestId: supplied !== null,
    invalidRequestId: supplied !== null && !REQUEST_ID_PATTERN.test(supplied),
  };
}

export function requestContextHeaders(context: RequestContext): Headers {
  const headers = new Headers({
    "X-Request-ID": context.requestId,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  return headers;
}
