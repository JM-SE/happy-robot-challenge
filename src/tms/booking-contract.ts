import { TmsValidationError } from "./errors";
import { MAX_PUBLIC_RATE, type PublicBookingRequest, type PublicBookingResult } from "./public-contracts";

export interface MockBookingResult {
  bookingRef: string;
  loadId: string;
  agreedRate: number;
  bookedAt: string;
}

export interface MockBookingPort {
  book(request: PublicBookingRequest): Promise<MockBookingResult>;
}

export function toPublicBookingResult(result: MockBookingResult): PublicBookingResult {
  if (!Number.isFinite(result.agreedRate) || result.agreedRate <= 0 || result.agreedRate > MAX_PUBLIC_RATE) {
    throw new TmsValidationError("The booking result rate is invalid.");
  }
  return {
    bookingRef: result.bookingRef,
    loadId: result.loadId,
    agreedRate: result.agreedRate,
    bookedAt: result.bookedAt,
    mode: "mock",
    demo: true,
  };
}
