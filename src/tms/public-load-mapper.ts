import { setTmsMappingRecordIndex, TmsUpstreamError, type TmsMappingFailureDetail, type TmsMappingValueShape } from "./errors";
import { MAX_HTTP_TEXT_BYTES } from "./limits";
import {
  MAX_PUBLIC_DATE_LENGTH,
  MAX_PUBLIC_MILES,
  MAX_PUBLIC_RATE,
  PUBLIC_LOAD_STATUSES,
  type PublicLoadDetail,
  type PublicLoadStatus,
  type PublicLoadSummary,
} from "./public-contracts";
import type { LoadPublic } from "./types";

function invalid(field: string, detail?: TmsMappingFailureDetail, shape?: TmsMappingValueShape, observedLength?: number): never {
  throw new TmsUpstreamError(`Load response contains invalid ${field} data.`, {
    category: "invalid-field",
    field,
    ...(detail === undefined ? {} : { detail }),
    ...(shape === undefined ? {} : { shape }),
    ...(observedLength === undefined ? {} : { observedLength }),
  });
}

function safeRequiredText(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_HTTP_TEXT_BYTES || /[|\r\n]/.test(value)) invalid(field);
  return value;
}

function state(value: unknown, field: string): string {
  const normalized = safeRequiredText(value, field).toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) invalid(field);
  return normalized;
}

function equipment(value: unknown): string {
  return safeRequiredText(value, "equipmentType").toUpperCase();
}

function rate(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > MAX_PUBLIC_RATE) invalid("rate");
  return value;
}

function dateShape(value: string): TmsMappingValueShape {
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return "iso-datetime";
  if (/^\d{4}-\d{2}-\d{2}(?:\s|$)/.test(value)) return "iso-date";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return "slash-date";
  if (/^\d{14}$/.test(value)) return "compact-datetime";
  if (/^\d{8}$/.test(value)) return "compact-date";
  return "other";
}

function compactDatetimeDate(value: string): string {
  const year = value.slice(0, 4);
  const month = value.slice(4, 6);
  const day = value.slice(6, 8);
  const hours = value.slice(8, 10);
  const minutes = value.slice(10, 12);
  const seconds = value.slice(12, 14);
  const isoDatetime = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.000Z`;
  const parsed = new Date(isoDatetime);

  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString() !== isoDatetime) {
    invalid("pickupDate", "calendar", "compact-datetime", value.length);
  }

  return `${year}-${month}-${day}`;
}

function optionalDate(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") invalid("pickupDate", "non-string");
  const shape = dateShape(value);
  if (value.length === 0) invalid("pickupDate", "empty", shape, 0);
  if (shape === "compact-datetime") return compactDatetimeDate(value);
  if (value.length !== MAX_PUBLIC_DATE_LENGTH) invalid("pickupDate", "length", shape, value.length);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) invalid("pickupDate", "pattern", shape, value.length);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) invalid("pickupDate", "calendar", shape, value.length);
  return value;
}

function optionalMiles(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > MAX_PUBLIC_MILES) invalid("miles");
  return value;
}

function optionalStatus(value: unknown): PublicLoadStatus | undefined {
  if (value === undefined) return undefined;
  if (value !== PUBLIC_LOAD_STATUSES.AVAILABLE && value !== PUBLIC_LOAD_STATUSES.BOOKED) invalid("status");
  return value;
}

function mapLoad(load: LoadPublic): PublicLoadSummary {
  const mapped: PublicLoadSummary = {
    loadId: safeRequiredText(load.loadId, "loadId"),
    originState: state(load.originState, "originState"),
    destinationState: state(load.destinationState, "destinationState"),
    originCity: safeRequiredText(load.originCity, "originCity"),
    destinationCity: safeRequiredText(load.destinationCity, "destinationCity"),
    equipmentType: equipment(load.equipmentType),
    rate: rate(load.rate),
  };
  const pickupDate = optionalDate(load.pickupDate);
  const miles = optionalMiles(load.miles);
  const status = optionalStatus(load.status);
  if (pickupDate !== undefined) mapped.pickupDate = pickupDate;
  if (miles !== undefined) mapped.miles = miles;
  if (status !== undefined) mapped.status = status;
  return mapped;
}

export function toPublicLoadSummary(load: LoadPublic): PublicLoadSummary {
  return mapLoad(load);
}

export function toPublicLoadDetail(load: LoadPublic): PublicLoadDetail {
  const summary = mapLoad(load);
  return {
    loadId: summary.loadId,
    originState: summary.originState,
    destinationState: summary.destinationState,
    originCity: summary.originCity,
    destinationCity: summary.destinationCity,
    equipmentType: summary.equipmentType,
    rate: summary.rate,
    ...(summary.pickupDate !== undefined ? { pickupDate: summary.pickupDate } : {}),
    ...(summary.miles !== undefined ? { miles: summary.miles } : {}),
    ...(summary.status !== undefined ? { status: summary.status } : {}),
  };
}

export function mapPublicLoadSummaries(loads: readonly LoadPublic[], maxResults: number): PublicLoadSummary[] {
  const mapped = loads.map((load, recordIndex) => {
    try {
      return toPublicLoadSummary(load);
    } catch (error) {
      setTmsMappingRecordIndex(error, recordIndex);
      throw error;
    }
  });
  const ids = new Set<string>();
  for (let recordIndex = 0; recordIndex < mapped.length; recordIndex += 1) {
    const load = mapped[recordIndex]!;
    if (ids.has(load.loadId)) {
      throw new TmsUpstreamError("Load response contains duplicate load identity data.", { category: "duplicate-identity", field: "loadId", recordIndex });
    }
    ids.add(load.loadId);
  }
  return [...mapped].sort((left, right) => left.loadId.localeCompare(right.loadId)).slice(0, maxResults);
}
