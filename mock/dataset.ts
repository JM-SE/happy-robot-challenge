import type { LoadInternal } from "../src/tms/types";

export interface LoadBookingState {
  load: LoadInternal;
  status: "AVAILABLE" | "BOOKED";
  bookingRef?: string;
  bookedAt?: string;
}

export interface MockBooking {
  loadId: string;
  mcNumber: string;
  agreedRate: number;
  bookingRef: string;
  bookedAt: string;
}

export type BookingStateErrorCode = "UNKNOWN_LOAD" | "ALREADY_BOOKED" | "INVALID_RATE";

export class BookingStateError extends Error {
  constructor(readonly code: BookingStateErrorCode, message: string) {
    super(message);
    this.name = "BookingStateError";
  }
}

export const LOAD_DATASET: readonly LoadInternal[] = Object.freeze([
  Object.freeze({
    loadId: "LOAD-1001",
    originState: "TX",
    destinationState: "CA",
    originCity: "Dallas",
    destinationCity: "Los Angeles",
    equipmentType: "DRY_VAN",
    rate: 2450,
    notes: "Appointment required",
    maxBuy: 2300,
  }),
  Object.freeze({
    loadId: "LOAD-1002",
    originState: "IL",
    destinationState: "GA",
    originCity: "Chicago",
    destinationCity: "Atlanta",
    equipmentType: "REEFER",
    rate: 2900,
    notes: "",
    maxBuy: 2950,
  }),
]);

export function createLoadBookingState(): LoadBookingState[] {
  return LOAD_DATASET.map((load) => ({ load: { ...load }, status: "AVAILABLE" as const }));
}

export function bookLoadInState(state: LoadBookingState[], input: {
  loadId: string;
  mcNumber: string;
  agreedRate: number;
}): MockBooking {
  const current = state.find((candidate) => candidate.load.loadId === input.loadId);
  if (!current) throw new BookingStateError("UNKNOWN_LOAD", "Load was not found");
  if (current.status === "BOOKED") throw new BookingStateError("ALREADY_BOOKED", "Load is already booked");
  if (current.load.maxBuy === undefined || !Number.isFinite(input.agreedRate) || input.agreedRate <= 0 || input.agreedRate > current.load.maxBuy) {
    throw new BookingStateError("INVALID_RATE", "Agreed rate is outside the internal limit");
  }

  current.status = "BOOKED";
  current.bookingRef = `BOOK-${current.load.loadId}`;
  current.bookedAt = new Date().toISOString();
  return {
    loadId: current.load.loadId,
    mcNumber: input.mcNumber,
    agreedRate: input.agreedRate,
    bookingRef: current.bookingRef,
    bookedAt: current.bookedAt,
  };
}
