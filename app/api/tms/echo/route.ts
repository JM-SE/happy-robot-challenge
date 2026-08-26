import { randomUUID } from "node:crypto";
import { getTmsConfig } from "../../../../src/tms/config";
import { TmsClient } from "../../../../src/tms/client";
import { TmsValidationError } from "../../../../src/tms/errors";
import { errorResponse, json } from "../../../../src/tms/http";
import type { EchoResult } from "../../../../src/tms/types";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(new TmsValidationError("Request body must be valid JSON."));
  }

  if (!body || typeof body !== "object" || Array.isArray(body) || typeof (body as { message?: unknown }).message !== "string") {
    return errorResponse(new TmsValidationError("Request body must contain a message string."));
  }

  const message = (body as { message: string }).message;
  if (!message.trim() || message.includes("|") || message.includes("\r") || message.includes("\n")) {
    return errorResponse(new TmsValidationError("Message must be non-empty and contain no framing characters."));
  }

  const requestId = request.headers.get("x-request-id")?.slice(0, 64) || randomUUID();
  try {
    const client = new TmsClient(getTmsConfig());
    const response = await client.execute({ command: "DEBUG_ECHO", fields: { MSG: message }, requestId });
    const fields = response.records[0]?.fields;
    const data: EchoResult = {
      message: fields?.MSG ?? message,
      fieldCount: fields?.FIELD_COUNT ? Number(fields.FIELD_COUNT) : null,
    };
    return json({ ok: true, data }, 200);
  } catch (error) {
    return errorResponse(error);
  }
}
