import { describe, expect, it } from "vitest";
import { bookingReceiptToPublic, parseBookLoadInput, recordToBookingReceipt, toBookLoadFields } from "../../src/tms/booking";
import { bookLoadInState, BookingStateError, createLoadBookingState } from "../../mock/dataset";
import { parseResponse } from "../../src/tms/parser";
import { createInternalMaxBuyRateAuthority } from "../../src/tms/rate-authority";

describe("booking input and wire mapping", () => {
  it("normalizes numeric rates and maps the exact public fields", () => {
    const input = parseBookLoadInput({ loadId: " LOAD-1001 ", mcNumber: "12345", agreedRate: "2200" });
    expect(input).toEqual({ loadId: "LOAD-1001", mcNumber: "12345", agreedRate: 2200 });
    expect(toBookLoadFields(input)).toEqual({ LOAD_ID: "LOAD-1001", MC_NUM: "12345", AGREED_RATE: 2200 });
  });

  it.each([
    {},
    { loadId: "LOAD-1001", mcNum: "12345", agreedRate: 2200 },
    { loadId: "LOAD-1001", mcNumber: "", agreedRate: 2200 },
    { loadId: "LOAD-1001", mcNumber: "12345", agreedRate: 0 },
    { loadId: "LOAD-1001", mcNumber: "12345", agreedRate: "not-a-rate" },
    { loadId: "LOAD|1001", mcNumber: "12345", agreedRate: 2200 },
  ])("rejects invalid booking body %#", (body) => {
    expect(() => parseBookLoadInput(body)).toThrow();
  });

  it("transitions an isolated load once and preserves the booking reference", () => {
    const state = createLoadBookingState();
    const booking = bookLoadInState(state, { loadId: "LOAD-1001", mcNumber: "12345", agreedRate: 2200 });
    expect(booking.bookingRef).toBe("BOOK-LOAD-1001");
    expect(booking.bookedAt).toMatch(/Z$/);
    expect(state.find((item) => item.load.loadId === "LOAD-1001")?.status).toBe("BOOKED");
    expect(() => bookLoadInState(state, { loadId: "LOAD-1001", mcNumber: "12345", agreedRate: 2200 })).toThrowError(
      new BookingStateError("ALREADY_BOOKED", "Load is already booked"),
    );
  });

  it("maps the canonical booking receipt and composes rate/MC from request context", () => {
    const receipt = recordToBookingReceipt(parseResponse(
      "STATUS:BOOKED|TIMESTAMP:20260512080000|BOOKING_REF:BOOK-1|LOAD_ID:LOAD-1\r\nEND\r\n",
    ).records[0]!);
    expect(receipt).toEqual({ loadId: "LOAD-1", bookingRef: "BOOK-1", status: "BOOKED", timestamp: "2026-05-12T08:00:00.000Z" });
    expect(bookingReceiptToPublic(receipt, { loadId: "LOAD-1", mcNumber: "12345", agreedRate: 100 })).toEqual({
      loadId: "LOAD-1", mcNumber: "12345", agreedRate: 100, bookingRef: "BOOK-1", bookedAt: "2026-05-12T08:00:00.000Z",
    });
  });

  it.each([
    "LOAD_ID:LOAD-1|BOOKING_REF:BOOK-1|STATUS:BOOKED|BOOKED_AT:2026-01-01T00:00:00.000Z",
    "LOAD_ID:LOAD-1|BOOKING_REF:BOOK-1|STATUS:AVAILABLE|TIMESTAMP:20260101000000",
    "LOAD_ID:LOAD-1|BOOKING_REF:BOOK-1|STATUS:BOOKED|TIMESTAMP:20261301000000",
  ])("rejects a non-canonical booking receipt", (line) => {
    expect(() => recordToBookingReceipt(parseResponse(`${line}\r\nEND\r\n`).records[0]!)).toThrow();
  });

  it("keeps separate mock state isolated and enforces internal MAX_BUY", () => {
    const first = createLoadBookingState();
    const second = createLoadBookingState();
    expect(() => bookLoadInState(first, { loadId: "LOAD-1001", mcNumber: "12345", agreedRate: 2301 })).toThrowError(/internal limit/);
    expect(bookLoadInState(second, { loadId: "LOAD-1001", mcNumber: "12345", agreedRate: 2200 }).loadId).toBe("LOAD-1001");
    expect(first.find((item) => item.load.loadId === "LOAD-1001")?.status).toBe("AVAILABLE");
  });

  it("authorizes rates against private MAX_BUY without exposing the ceiling", () => {
    const authority = createInternalMaxBuyRateAuthority();
    const load = { loadId: "LOAD-1", originState: "TX", destinationState: "CA", originCity: "Dallas", destinationCity: "LA", equipmentType: "DRY_VAN", rate: 100, notes: "", maxBuy: 90 };

    expect(() => authority.authorize({ loadId: "LOAD-1", agreedRate: 90, load })).not.toThrow();
    expect(() => authority.authorize({ loadId: "LOAD-1", agreedRate: 91, load })).toThrowError("The offered rate was not accepted.");
    try {
      authority.authorize({ loadId: "LOAD-1", agreedRate: 91, load });
    } catch (error) {
      expect(error).not.toHaveProperty("maxBuy");
      expect(String(error)).not.toContain("90");
    }
  });
});
