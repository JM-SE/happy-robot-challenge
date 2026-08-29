import { TmsValidationError } from "./errors";
import { MAX_HTTP_TEXT_BYTES } from "./limits";
import type { LoadDetailInput, LoadQueryInput, LoadPublic } from "./types";
import { MAX_RESULTS_LIMIT } from "./loads";

function object(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new TmsValidationError("Request body must be an object.");
  return body as Record<string, unknown>;
}
function exact(source: Record<string, unknown>, keys: readonly string[]) {
  if (Object.keys(source).some((key) => !keys.includes(key))) throw new TmsValidationError("Request contains an unsupported field.");
}
function text(value: unknown, name: string, max = MAX_HTTP_TEXT_BYTES): string {
  if (typeof value !== "string" || !value.trim() || value.length > max || /[|\r\n]/.test(value)) throw new TmsValidationError(`${name} is invalid.`);
  return value.trim();
}
export function parseHttpEcho(body: unknown): { message: string } {
  const source = object(body); exact(source, ["message"]); return { message: text(source.message, "message") };
}
export function parseHttpSearch(body: unknown): LoadQueryInput {
  const source = object(body); exact(source, ["originState", "destinationState", "equipmentType", "maxResults"]);
  const result: LoadQueryInput = {};
  if (source.originState !== undefined) { const value = text(source.originState, "originState").toUpperCase(); if (!/^[A-Z]{2}$/.test(value)) throw new TmsValidationError("originState is invalid."); result.originState = value; }
  if (source.destinationState !== undefined) { const value = text(source.destinationState, "destinationState").toUpperCase(); if (!/^[A-Z]{2}$/.test(value)) throw new TmsValidationError("destinationState is invalid."); result.destinationState = value; }
  if (source.equipmentType !== undefined) result.equipmentType = text(source.equipmentType, "equipmentType").toUpperCase();
  if (source.maxResults !== undefined) { if (typeof source.maxResults !== "number" || !Number.isInteger(source.maxResults) || source.maxResults < 1 || source.maxResults > MAX_RESULTS_LIMIT) throw new TmsValidationError("maxResults is invalid."); result.maxResults = source.maxResults; }
  if (!result.originState && !result.destinationState && !result.equipmentType) throw new TmsValidationError("Search requires at least one load filter.");
  return result;
}
export function parseHttpDetail(body: unknown): LoadDetailInput {
  const source = object(body); exact(source, ["loadId"]); return { loadId: text(source.loadId, "loadId", 64) };
}
export function parseHttpBooking(body: unknown): { loadId: string; mc: string; agreedRate: number } {
  const source = object(body); exact(source, ["loadId", "mc", "agreedRate"]);
  if (typeof source.agreedRate !== "number" || !Number.isFinite(source.agreedRate) || source.agreedRate <= 0) throw new TmsValidationError("agreedRate is invalid.");
  return { loadId: text(source.loadId, "loadId", 64), mc: text(source.mc, "mc", 64), agreedRate: source.agreedRate };
}
export function toHttpPublicLoad(load: LoadPublic): Record<string, unknown> {
  const { notes: _notes, ...safe } = load;
  void _notes;
  return safe;
}
