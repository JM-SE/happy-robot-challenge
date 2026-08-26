import { describe, expect, it } from "vitest";
import { parseBookLoadInput, toBookLoadFields } from "../../src/tms/booking";
import { bookLoadInState, BookingStateError, createLoadBookingState } from "../../mock/dataset";

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

  it("keeps separate mock state isolated and enforces internal MAX_BUY", () => {
    const first = createLoadBookingState();
    const second = createLoadBookingState();
    expect(() => bookLoadInState(first, { loadId: "LOAD-1001", mcNumber: "12345", agreedRate: 2301 })).toThrowError(/internal limit/);
    expect(bookLoadInState(second, { loadId: "LOAD-1001", mcNumber: "12345", agreedRate: 2200 }).loadId).toBe("LOAD-1001");
    expect(first.find((item) => item.load.loadId === "LOAD-1001")?.status).toBe("AVAILABLE");
  });
});
