import { TmsUpstreamError, TmsValidationError } from "./errors";
import type { BookLoadInput, BookingPublic, BookingReceipt, BookingRequestContext, TmsRecord } from "./types";

const MAX_RATE = 1_000_000_000;

function trimAscii(value: string): string {
  return value.replace(/^[ \t]+|[ \t]+$/g, "");
}

function safeText(value: unknown, name: string, maxLength: number): string {
  if (typeof value !== "string") throw new TmsValidationError(`${name} must be a string.`);
  const normalized = trimAscii(value);
  if (!normalized || normalized.length > maxLength || /[|\r\n]/.test(normalized)) {
    throw new TmsValidationError(`${name} must be non-empty, bounded and contain no framing characters.`);
  }
  return normalized;
}

function normalizeRate(value: unknown): number {
  if (typeof value !== "number" && typeof value !== "string") {
    throw new TmsValidationError("agreedRate must be a number or numeric string.");
  }
  const raw = typeof value === "string" ? trimAscii(value) : value;
  if (raw === "") throw new TmsValidationError("agreedRate must be positive.");
  const rate = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(rate) || rate <= 0 || rate > MAX_RATE || Math.round(rate * 100) !== rate * 100) {
    throw new TmsValidationError("agreedRate must be a positive amount with at most two decimals.");
  }
  return rate;
}

export function parseBookLoadInput(body: unknown): BookLoadInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new TmsValidationError("Booking body must be an object.");
  }
  const source = body as Record<string, unknown>;
  for (const key of Object.keys(source)) {
    if (!["loadId", "mcNumber", "agreedRate"].includes(key)) {
      throw new TmsValidationError(`Unknown field: ${key}.`);
    }
  }
  return {
    loadId: safeText(source.loadId, "loadId", 64),
    mcNumber: safeText(source.mcNumber, "mcNumber", 32),
    agreedRate: normalizeRate(source.agreedRate),
  };
}

export function toBookLoadFields(input: BookLoadInput): Record<string, string | number> {
  return {
    LOAD_ID: input.loadId,
    MC_NUM: input.mcNumber,
    AGREED_RATE: input.agreedRate,
  };
}

function required(fields: Record<string, string>, name: string, maxLength = 64): string {
  const value = fields[name];
  if (value === undefined || !value || value.length > maxLength || /[|\r\n]/.test(value)) throw new TmsUpstreamError(`Booking response contains an invalid ${name}.`);
  return value;
}

function compactTimestampToUtc(value: string): string {
  if (!/^\d{14}$/.test(value)) throw new TmsUpstreamError("Booking response contains an invalid timestamp.");
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  const hour = Number(value.slice(8, 10));
  const minute = Number(value.slice(10, 12));
  const second = Number(value.slice(12, 14));
  const date = new Date(0);
  date.setUTCHours(hour, minute, second, 0);
  date.setUTCFullYear(year, month - 1, day);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day || date.getUTCHours() !== hour || date.getUTCMinutes() !== minute || date.getUTCSeconds() !== second) {
    throw new TmsUpstreamError("Booking response contains an invalid timestamp.");
  }
  return date.toISOString();
}

export function recordToBookingReceipt(record: TmsRecord): BookingReceipt {
  return {
    loadId: required(record.fields, "LOAD_ID"),
    bookingRef: required(record.fields, "BOOKING_REF"),
    status: record.fields.STATUS === "BOOKED" ? "BOOKED" : (() => { throw new TmsUpstreamError("Booking response contains an invalid status."); })(),
    timestamp: compactTimestampToUtc(required(record.fields, "TIMESTAMP", 14)),
  };
}

export function bookingReceiptToPublic(receipt: BookingReceipt, context: BookingRequestContext): BookingPublic {
  return {
    loadId: receipt.loadId,
    mcNumber: context.mcNumber,
    agreedRate: context.agreedRate,
    bookingRef: receipt.bookingRef,
    bookedAt: receipt.timestamp,
  };
}
