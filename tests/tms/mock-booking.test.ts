import { describe, expect, it } from "vitest";
import { BookingConflictError, LoadNotFoundError, RateNotAcceptedError } from "../../src/tms/domain-errors";
import { createMockBookingPort } from "../../src/tms/mock-booking-port";

const request = { loadId: "LOAD-1002", mc: "never-persisted", agreedRate: 2900 };

describe("deterministic mock booking", () => {
  it("returns the fixed demo result and isolates fresh stores", async () => {
    const first = await createMockBookingPort().book(request);
    const second = await createMockBookingPort().book(request);

    expect(first).toEqual({
      bookingRef: "BOOK-LOAD-1002",
      loadId: "LOAD-1002",
      agreedRate: 2900,
      bookedAt: "2000-01-01T00:00:00.000Z",
    });
    expect(second).toEqual(first);
    expect(first).not.toHaveProperty("mc");
  });

  it("rejects unknown loads and unacceptable rates without consuming availability", async () => {
    const port = createMockBookingPort();

    await expect(port.book({ ...request, loadId: "LOAD-404" })).rejects.toBeInstanceOf(LoadNotFoundError);
    await expect(port.book({ ...request, agreedRate: 2800 })).rejects.toBeInstanceOf(RateNotAcceptedError);
    await expect(port.book(request)).resolves.toMatchObject({ bookingRef: "BOOK-LOAD-1002" });
  });

  it("allows at most one concurrent booking and rejects repeats", async () => {
    const port = createMockBookingPort();
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => port.book(request)));
    const successes = results.filter((result) => result.status === "fulfilled");
    const conflicts = results.filter((result) => result.status === "rejected" && result.reason instanceof BookingConflictError);

    expect(successes).toHaveLength(1);
    expect(conflicts).toHaveLength(7);
    await expect(port.book(request)).rejects.toBeInstanceOf(BookingConflictError);
  });
});
