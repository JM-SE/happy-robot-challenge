import { TmsValidationError } from "./errors";
import type { TmsRequest } from "./types";

const IDENTIFIER = /^[A-Z][A-Z0-9_]*$/;
const CRLF = "\r\n";

function assertIdentifier(value: string, kind: "command" | "field"): void {
  if (!IDENTIFIER.test(value)) throw new TmsValidationError(`Invalid TMS ${kind} name.`);
}

function assertValue(value: string, kind: string): void {
  if (!value || value.includes("|") || value.includes("\r") || value.includes("\n")) {
    throw new TmsValidationError(`Invalid TMS ${kind} value.`);
  }
}

export function buildRequest(request: TmsRequest, maxFrameBytes = 4096): Buffer {
  assertIdentifier(request.command, "command");
  assertValue(request.authToken, "auth");
  if (!Number.isInteger(maxFrameBytes) || maxFrameBytes <= 0) throw new TmsValidationError("Invalid TMS frame limit.");

  const fields = request.fields ?? {};
  const serialized = [`CMD:${request.command}`, `AUTH:${request.authToken}`];
  for (const [name, rawValue] of Object.entries(fields)) {
    assertIdentifier(name, "field");
    if (name === "CMD" || name === "AUTH") throw new TmsValidationError(`Reserved TMS field: ${name}.`);
    const value = String(rawValue);
    assertValue(value, name);
    serialized.push(`${name}:${value}`);
  }

  const frame = Buffer.from(`${serialized.join("|")}${CRLF}`, "utf8");
  if (frame.byteLength > maxFrameBytes) throw new TmsValidationError("TMS request exceeds the configured frame limit.");
  return frame;
}
