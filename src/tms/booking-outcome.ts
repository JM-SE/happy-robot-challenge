import { isTmsAdapterError, TmsRemoteError } from "./errors";
import type { BookingReceipt } from "./types";

export type BookingOutcome = "confirmed-success" | "confirmed-rejection" | "unknown" | "not-attempted";

const CONFIRMED_REJECTIONS = new Set(["INVALID_RATE", "UNKNOWN_LOAD", "ALREADY_BOOKED", "MISSING_FIELD"]);

export interface BookingOutcomeInput {
  expectedLoadId: string;
  receipt?: BookingReceipt;
  error?: unknown;
  writeDisposition: "not-sent" | "sent" | "unknown";
}

export function classifyBookingOutcome(input: BookingOutcomeInput): BookingOutcome {
  if (input.receipt) return input.receipt.loadId === input.expectedLoadId ? "confirmed-success" : "unknown";
  if (input.error instanceof TmsRemoteError && CONFIRMED_REJECTIONS.has(input.error.remoteCode)) return "confirmed-rejection";
  if (input.writeDisposition === "not-sent") return "not-attempted";
  return "unknown";
}

export function bookingWriteDisposition(error: unknown): "not-sent" | "sent" | "unknown" {
  return isTmsAdapterError(error) ? error.metadata.writeDisposition ?? "unknown" : "unknown";
}
