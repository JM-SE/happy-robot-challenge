import { TmsValidationError } from "./errors";
import { MAX_TMS_REQUEST_FRAME_BYTES } from "./limits";
import type { TmsRequest } from "./types";

const IDENTIFIER = /^[A-Z][A-Z0-9_]*$/;
const CRLF = "\r\n";

function assertIdentifier(value: string, kind: "command" | "field"): void {
  if (typeof value !== "string" || !IDENTIFIER.test(value)) throw new TmsValidationError(`Invalid TMS ${kind} name.`);
}

function assertValue(value: unknown, kind: string): asserts value is string | number {
  const isFiniteNumber = typeof value === "number" && Number.isFinite(value);
  if ((typeof value !== "string" && !isFiniteNumber) || value === "" || (typeof value === "string" && (value.includes("|") || value.includes("\r") || value.includes("\n") || [...value].some((character) => character.charCodeAt(0) > 0x7f)))) {
    throw new TmsValidationError(`Invalid TMS ${kind} value.`);
  }
}

export function buildRequest(request: TmsRequest, maxRequestBytes = MAX_TMS_REQUEST_FRAME_BYTES): Buffer {
  assertIdentifier(request.command, "command");
  assertValue(request.authToken, "auth");
  if (!Number.isInteger(maxRequestBytes) || maxRequestBytes <= 0 || maxRequestBytes > MAX_TMS_REQUEST_FRAME_BYTES) throw new TmsValidationError("Invalid TMS request frame limit.");

  const fields = request.fields ?? {};
  const serialized = [`CMD:${request.command}`, `AUTH:${request.authToken}`];
  for (const [name, rawValue] of Object.entries(fields)) {
    assertIdentifier(name, "field");
    if (name === "CMD" || name === "AUTH") throw new TmsValidationError(`Reserved TMS field: ${name}.`);
    assertValue(rawValue, name);
    const value = String(rawValue);
    serialized.push(`${name}:${value}`);
  }

  const frame = Buffer.from(`${serialized.join("|")}${CRLF}`, "utf8");
  if (frame.byteLength > maxRequestBytes) throw new TmsValidationError("TMS request exceeds the configured frame limit.");
  return frame;
}
