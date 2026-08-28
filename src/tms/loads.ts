import { TmsUpstreamError, TmsValidationError } from "./errors";
import { MAX_HTTP_TEXT_BYTES } from "./limits";
import type { LoadDetailInput, LoadInternal, LoadPublic, LoadQueryInput, TmsRecord } from "./types";

export const MAX_RESULTS_LIMIT = 50;

const SEARCH_FIELDS = [
  "originState",
  "destinationState",
  "originCity",
  "destinationCity",
  "originZip",
  "destinationZip",
  "equipmentType",
] as const;

function trimAscii(value: string): string {
  return value.replace(/^[ \t]+|[ \t]+$/g, "");
}

function assertSafeText(value: string, name: string): string {
  const normalized = trimAscii(value);
  if (!normalized || normalized.length > MAX_HTTP_TEXT_BYTES || normalized.includes("|") || normalized.includes("\r") || normalized.includes("\n")) {
    throw new TmsValidationError(`${name} must be non-empty and contain no framing characters.`);
  }
  return normalized;
}

function normalizeState(value: unknown, name: string): string {
  if (typeof value !== "string") throw new TmsValidationError(`${name} must be a string.`);
  const normalized = assertSafeText(value, name).toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) throw new TmsValidationError(`${name} must be a two-letter state code.`);
  return normalized;
}

function normalizeCity(value: unknown, name: string): string {
  if (typeof value !== "string") throw new TmsValidationError(`${name} must be a string.`);
  return assertSafeText(value, name);
}

function normalizeZip(value: unknown, name: string): string {
  if (typeof value !== "string") throw new TmsValidationError(`${name} must be a string.`);
  return assertSafeText(value, name);
}

function normalizeEquipmentType(value: unknown): string {
  if (typeof value !== "string") throw new TmsValidationError("equipmentType must be a string.");
  return assertSafeText(value, "equipmentType").toUpperCase();
}

function normalizeMaxResults(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0 || value > MAX_RESULTS_LIMIT) {
    throw new TmsValidationError(`maxResults must be a positive integer no greater than ${MAX_RESULTS_LIMIT}.`);
  }
  return value;
}

function rejectUnknownKeys(body: Record<string, unknown>, allowed: readonly string[]): void {
  for (const key of Object.keys(body)) {
    if (!allowed.includes(key)) throw new TmsValidationError(`Unknown field: ${key}.`);
  }
}

export function parseLoadQueryInput(body: unknown): LoadQueryInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new TmsValidationError("Search body must be an object.");
  }
  const source = body as Record<string, unknown>;
  rejectUnknownKeys(source, [...SEARCH_FIELDS, "maxResults"]);
  const input: LoadQueryInput = {};
  if (source.originState !== undefined) input.originState = normalizeState(source.originState, "originState");
  if (source.destinationState !== undefined) input.destinationState = normalizeState(source.destinationState, "destinationState");
  if (source.originCity !== undefined) input.originCity = normalizeCity(source.originCity, "originCity");
  if (source.destinationCity !== undefined) input.destinationCity = normalizeCity(source.destinationCity, "destinationCity");
  if (source.originZip !== undefined) input.originZip = normalizeZip(source.originZip, "originZip");
  if (source.destinationZip !== undefined) input.destinationZip = normalizeZip(source.destinationZip, "destinationZip");
  if (source.equipmentType !== undefined) input.equipmentType = normalizeEquipmentType(source.equipmentType);
  if (source.maxResults !== undefined) input.maxResults = normalizeMaxResults(source.maxResults);

  if (!SEARCH_FIELDS.some((field) => input[field] !== undefined)) {
    throw new TmsValidationError("Search requires at least one load filter.");
  }
  return input;
}

export function parseLoadDetailInput(body: unknown): LoadDetailInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new TmsValidationError("Detail body must be an object.");
  }
  const source = body as Record<string, unknown>;
  rejectUnknownKeys(source, ["loadId"]);
  if (typeof source.loadId !== "string") throw new TmsValidationError("loadId must be a string.");
  const loadId = assertSafeText(source.loadId, "loadId");
  if (loadId.length > 64) throw new TmsValidationError("loadId is too long.");
  return { loadId };
}

export function toLoadQueryFields(input: LoadQueryInput): Record<string, string | number> {
  return Object.fromEntries([
    ["ORIG_STATE", input.originState],
    ["DEST_STATE", input.destinationState],
    ["ORIG_CITY", input.originCity],
    ["DEST_CITY", input.destinationCity],
    ["ORIG_ZIP", input.originZip],
    ["DEST_ZIP", input.destinationZip],
    ["EQTYPE", input.equipmentType],
    ["MAX_RESULTS", input.maxResults],
  ].filter((entry): entry is [string, string | number] => entry[1] !== undefined));
}

export function toLoadDetailFields(input: LoadDetailInput): Record<string, string> {
  return { LOAD_ID: input.loadId };
}

export function recordToPublicLoad(record: TmsRecord): LoadPublic {
  const fields = record.fields;
  const rate = Number(requiredField(fields, "RATE"));
  if (!Number.isFinite(rate)) throw new TmsUpstreamError("Load response contains invalid rate data.");
  const miles = optionalFiniteNumber(fields.MILES);
  return {
    loadId: requiredField(fields, "LOAD_ID"),
    originState: requiredField(fields, "ORIG_STATE"),
    destinationState: requiredField(fields, "DEST_STATE"),
    originCity: requiredField(fields, "ORIG_CITY"),
    destinationCity: requiredField(fields, "DEST_CITY"),
    equipmentType: requiredField(fields, "EQTYPE"),
    rate,
    notes: fields.NOTES ?? "",
    ...(fields.PICKUP_DT !== undefined ? { pickupDate: fields.PICKUP_DT } : {}),
    ...(miles !== undefined ? { miles } : {}),
    ...(fields.STATUS !== undefined ? { status: fields.STATUS } : {}),
  };
}

function requiredField(fields: Record<string, string>, name: string): string {
  const value = fields[name];
  if (value === undefined || !value) throw new TmsUpstreamError(`Load response is missing ${name}.`);
  return value;
}

export function recordToLoadInternal(record: TmsRecord): LoadInternal {
  const fields = record.fields;
  const rate = Number(requiredField(fields, "RATE"));
  const maxBuy = fields.MAX_BUY === undefined ? undefined : Number(fields.MAX_BUY);
  if (!Number.isFinite(rate) || (maxBuy !== undefined && !Number.isFinite(maxBuy))) throw new TmsUpstreamError("Load response contains invalid rate data.");
  const miles = optionalFiniteNumber(fields.MILES);
  return {
    loadId: requiredField(fields, "LOAD_ID"),
    originState: requiredField(fields, "ORIG_STATE"),
    destinationState: requiredField(fields, "DEST_STATE"),
    originCity: requiredField(fields, "ORIG_CITY"),
    destinationCity: requiredField(fields, "DEST_CITY"),
    equipmentType: requiredField(fields, "EQTYPE"),
    rate,
    notes: fields.NOTES ?? "",
    ...(maxBuy !== undefined ? { maxBuy } : {}),
    ...(fields.PICKUP_DT !== undefined ? { pickupDate: fields.PICKUP_DT } : {}),
    ...(miles !== undefined ? { miles } : {}),
    ...(fields.STATUS !== undefined ? { status: fields.STATUS } : {}),
  };
}

function optionalFiniteNumber(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export function toPublicLoad(load: LoadInternal): LoadPublic {
  const { maxBuy, ...publicLoad } = load;
  void maxBuy;
  return publicLoad;
}
