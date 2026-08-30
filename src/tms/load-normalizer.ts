import { setTmsMappingRecordIndex, TmsUpstreamError, type TmsMappingFailureDetail } from "./errors";
import { MAX_HTTP_TEXT_BYTES } from "./limits";
import { MAX_TMS_STATUS_LENGTH } from "./public-contracts";
import type { NormalizedLoad, TmsRecord } from "./types";

export interface LoadNormalizationContext {
  readonly recordIndex?: number;
}

function invalid(field: string, detail?: TmsMappingFailureDetail): never {
  const error = new TmsUpstreamError(`Load response contains invalid ${field} data.`, {
    category: "invalid-field",
    field,
    ...(detail === undefined ? {} : { detail }),
  });
  throw error;
}

function required(fields: Record<string, string>, name: string): string {
  const value = fields[name];
  if (value === undefined || value === "") {
    throw new TmsUpstreamError(`Load response is missing ${name}.`, { category: "missing-field", field: name });
  }
  return value;
}

function text(fields: Record<string, string>, name: string): string {
  const value = required(fields, name);
  if (value.length > MAX_HTTP_TEXT_BYTES || /[|\r\n\u0000-\u001f\u007f]/.test(value)) invalid(name);
  return value;
}

function state(fields: Record<string, string>, name: string): string {
  const value = text(fields, name).toUpperCase();
  if (!/^[A-Z]{2}$/.test(value)) invalid(name, "pattern");
  return value;
}

function numberField(fields: Record<string, string>, name: string, positive = false): number {
  const value = required(fields, name);
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || (positive ? parsed <= 0 : parsed < 0)) invalid(name === "RATE" ? "rate" : "maxBuy", "pattern");
  return parsed;
}

function optionalNumber(fields: Record<string, string>, name: string): number | undefined {
  const value = fields[name];
  if (value === undefined) return undefined;
  if (value === "") invalid(name === "MILES" ? "miles" : name, "empty");
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) invalid(name === "MILES" ? "miles" : name, "pattern");
  return parsed;
}

function compactLocalDateTime(value: string, field: string): string {
  if (!/^\d{14}$/.test(value)) invalid(field, "pattern");
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  const hour = Number(value.slice(8, 10));
  const minute = Number(value.slice(10, 12));
  const second = Number(value.slice(12, 14));
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day
    || date.getUTCHours() !== hour || date.getUTCMinutes() !== minute || date.getUTCSeconds() !== second) {
    invalid(field, "calendar");
  }
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(8, 10)}:${value.slice(10, 12)}:${value.slice(12, 14)}`;
}

function optionalDate(fields: Record<string, string>, wireName: string, publicName: string): string | undefined {
  const value = fields[wireName];
  if (value === undefined) return undefined;
  if (value === "") invalid(publicName, "empty");
  return compactLocalDateTime(value, publicName);
}

function optionalStatus(fields: Record<string, string>): string | undefined {
  const value = fields.STATUS;
  if (value === undefined) return undefined;
  if (value === "" || value.length > MAX_TMS_STATUS_LENGTH || /[|\r\n\u0000-\u001f\u007f]/.test(value)) invalid("status", value === "" ? "empty" : "pattern");
  return value;
}

export function normalizeLoadRecord(record: TmsRecord, context: LoadNormalizationContext = {}): NormalizedLoad {
  void context;
  const fields = record.fields;
  const known = new Set(["LOAD_ID", "ORIG_STATE", "DEST_STATE", "ORIG_CITY", "DEST_CITY", "EQTYPE", "RATE", "NOTES", "MAX_BUY", "PICKUP_DT", "DELIVERY_DT", "MILES", "STATUS"]);
  const opaqueFields = Object.fromEntries(Object.entries(fields).filter(([name]) => !known.has(name)));
  const maxBuy = fields.MAX_BUY === undefined ? undefined : numberField(fields, "MAX_BUY");
  const notes = fields.NOTES ?? "";
  if (notes.length > MAX_HTTP_TEXT_BYTES || /[|\r\n\u0000-\u001f\u007f]/.test(notes)) invalid("notes");
  return {
    loadId: text(fields, "LOAD_ID"),
    originState: state(fields, "ORIG_STATE"),
    destinationState: state(fields, "DEST_STATE"),
    originCity: text(fields, "ORIG_CITY"),
    destinationCity: text(fields, "DEST_CITY"),
    equipmentType: text(fields, "EQTYPE").toUpperCase(),
    rate: numberField(fields, "RATE", true),
    notes,
    ...(maxBuy === undefined ? {} : { maxBuy }),
    ...(fields.PICKUP_DT === undefined ? {} : { pickupDate: optionalDate(fields, "PICKUP_DT", "pickupDate")! }),
    ...(fields.DELIVERY_DT === undefined ? {} : { deliveryDate: optionalDate(fields, "DELIVERY_DT", "deliveryDate")! }),
    ...(fields.MILES === undefined ? {} : { miles: optionalNumber(fields, "MILES")! }),
    ...(fields.STATUS === undefined ? {} : { status: optionalStatus(fields)! }),
    ...(Object.keys(opaqueFields).length === 0 ? {} : { opaqueFields }),
  };
}

export function normalizeLoadRecordWithIndex(record: TmsRecord, recordIndex: number): NormalizedLoad {
  try {
    return normalizeLoadRecord(record, { recordIndex });
  } catch (error) {
    setTmsMappingRecordIndex(error, recordIndex);
    throw error;
  }
}
