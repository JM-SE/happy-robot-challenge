import { BookingConflictError, LoadNotFoundError } from "./domain-errors";

interface MockBookingEntry {
  status: "AVAILABLE" | "BOOKED";
  bookingRef?: string;
  bookedAt?: string;
}

export interface MockBookingStore {
  status(loadId: string): "AVAILABLE" | "BOOKED" | undefined;
  book(loadId: string, bookingRef: string, bookedAt: string): void;
}

export function createMockBookingStore(loadIds: readonly string[]): MockBookingStore {
  const entries = new Map<string, MockBookingEntry>(loadIds.map((loadId) => [loadId, { status: "AVAILABLE" }]));

  return {
    status(loadId) {
      return entries.get(loadId)?.status;
    },
    book(loadId, bookingRef, bookedAt) {
      const entry = entries.get(loadId);
      if (!entry) throw new LoadNotFoundError();
      if (entry.status === "BOOKED") throw new BookingConflictError();
      entry.status = "BOOKED";
      entry.bookingRef = bookingRef;
      entry.bookedAt = bookedAt;
    },
  };
}
