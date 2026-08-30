import { describe, expect, it } from "vitest";
import { bookingWriteDisposition, classifyBookingOutcome } from "../../src/tms/booking-outcome";
import { TmsRemoteError, TmsTimeoutError } from "../../src/tms/errors";
import type { BookingReceipt } from "../../src/tms/types";

const receipt: BookingReceipt = {
  loadId: "LOAD-1",
  bookingRef: "BOOK-1",
  status: "BOOKED",
  timestamp: "2026-05-12T08:00:00.000Z",
};

describe("booking outcome classifier", () => {
  it("confirms a bound canonical receipt", () => {
    expect(classifyBookingOutcome({ expectedLoadId: "LOAD-1", receipt, writeDisposition: "sent" })).toBe("confirmed-success");
    expect(classifyBookingOutcome({ expectedLoadId: "LOAD-2", receipt, writeDisposition: "sent" })).toBe("unknown");
  });

  it.each(["INVALID_RATE", "UNKNOWN_LOAD", "ALREADY_BOOKED", "MISSING_FIELD"]) (
    "confirms %s as a definitive remote rejection",
    (code) => expect(classifyBookingOutcome({ expectedLoadId: "LOAD-1", error: new TmsRemoteError(code, "secret", false), writeDisposition: "sent" })).toBe("confirmed-rejection"),
  );

  it("keeps post-write failures unknown and local unsent failures not-attempted", () => {
    expect(classifyBookingOutcome({ expectedLoadId: "LOAD-1", error: new TmsRemoteError("SERVER_ERROR"), writeDisposition: "sent" })).toBe("unknown");
    expect(classifyBookingOutcome({ expectedLoadId: "LOAD-1", error: new TmsTimeoutError("RESPONSE_TIMEOUT"), writeDisposition: "unknown" })).toBe("unknown");
    expect(classifyBookingOutcome({ expectedLoadId: "LOAD-1", error: new Error("validation"), writeDisposition: "not-sent" })).toBe("not-attempted");
  });

  it("never derives a retry or disposition from remote message text", () => {
    const error = new TmsRemoteError("UNKNOWN_CODE", "INVALID_RATE", false);
    expect(classifyBookingOutcome({ expectedLoadId: "LOAD-1", error, writeDisposition: "sent" })).toBe("unknown");
    expect(bookingWriteDisposition(error)).toBe("unknown");
  });
});
