import { TmsUpstreamError, TmsValidationError } from "./errors";
import type { BookLoadInput, BookingPublic, TmsRecord } from "./types";

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

function required(fields: Record<string, string>, name: string): string {
  const value = fields[name];
  if (value === undefined || !value) throw new TmsUpstreamError(`Booking response is missing ${name}.`);
  return value;
}

export function recordToBookingPublic(record: TmsRecord): BookingPublic {
  const agreedRate = Number(required(record.fields, "AGREED_RATE"));
  if (!Number.isFinite(agreedRate)) throw new TmsUpstreamError("Booking response contains an invalid rate.");
  return {
    loadId: required(record.fields, "LOAD_ID"),
    mcNumber: required(record.fields, "MC_NUM"),
    agreedRate,
    bookingRef: required(record.fields, "BOOKING_REF"),
    bookedAt: required(record.fields, "BOOKED_AT"),
  };
}
