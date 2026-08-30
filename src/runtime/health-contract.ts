export interface LivenessPayload {
  readonly status: "ok";
}

export function livenessResponse(): Response {
  return Response.json({ status: "ok" } satisfies LivenessPayload, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}

export function methodNotAllowedResponse(): Response {
  return Response.json({ error: { code: "METHOD_NOT_ALLOWED", message: "Method is not allowed." } }, {
    status: 405,
    headers: { Allow: "GET", "Cache-Control": "no-store" },
  });
}
