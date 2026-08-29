import { BookingConflictError } from "./domain-errors";
import { DEMO_BOOKED_AT, knownMockLoadIds, validateMockBookingScenario } from "./mock-booking-scenarios";
import { createMockBookingStore, type MockBookingStore } from "./mock-booking-store";
import type { MockBookingPort, MockBookingResult } from "./booking-contract";
import type { PublicBookingRequest } from "./public-contracts";

export function createMockBookingPort(store: MockBookingStore = createMockBookingStore(knownMockLoadIds())): MockBookingPort {
  return {
    async book(request: PublicBookingRequest): Promise<MockBookingResult> {
      // Everything through the state transition is synchronous so Promise.all cannot race a check-then-await gap.
      const status = store.status(request.loadId);
      if (status === undefined) {
        validateMockBookingScenario(request);
      }
      if (status === "BOOKED") throw new BookingConflictError();
      validateMockBookingScenario(request);
      const bookingRef = `BOOK-${request.loadId}`;
      store.book(request.loadId, bookingRef, DEMO_BOOKED_AT);
      return { bookingRef, loadId: request.loadId, agreedRate: request.agreedRate, bookedAt: DEMO_BOOKED_AT };
    },
  };
}

let processMockBookingPort: MockBookingPort | undefined;

export function getProcessMockBookingPort(): MockBookingPort {
  processMockBookingPort ??= createMockBookingPort();
  return processMockBookingPort;
}
