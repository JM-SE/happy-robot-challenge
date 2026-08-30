import { describe, expect, it } from "vitest";
import { BookingConflictError, RateNotAcceptedError } from "../../src/tms/domain-errors";
import { mapPublicError } from "../../src/tms/http-contract";
import { parseHttpBooking, parseHttpSearch } from "../../src/tms/http-dto";
import { mapPublicLoadSummaries, toPublicLoadDetail } from "../../src/tms/public-load-mapper";
import type { LoadPublic } from "../../src/tms/types";

const load = (overrides: Partial<LoadPublic> = {}): LoadPublic => ({
  loadId: "LOAD-1002",
  originState: "IL",
  destinationState: "GA",
  originCity: "Chicago",
  destinationCity: "Atlanta",
  equipmentType: "REEFER",
  rate: 2900,
  notes: "private note",
  ...overrides,
});

describe("Phase 3B public contracts", () => {
  it("defaults search results and keeps the public request closed", () => {
    expect(parseHttpSearch({ originState: " tx " })).toEqual({ originState: "TX", maxResults: 10 });
    expect(() => parseHttpSearch({ originState: "TX", city: "Dallas" })).toThrow();
    expect(() => parseHttpSearch({ originState: "TX", maxResults: 51 })).toThrow();
  });

  it("validates booking rate precision and bounds", () => {
    expect(parseHttpBooking({ loadId: "LOAD-1", mc: "MC-1", agreedRate: 100.25 })).toEqual({ loadId: "LOAD-1", mc: "MC-1", agreedRate: 100.25 });
    expect(() => parseHttpBooking({ loadId: "LOAD-1", mc: "MC-1", agreedRate: 100.256 })).toThrow();
    expect(() => parseHttpBooking({ loadId: "LOAD-1", mc: "MC-1", agreedRate: 1_000_001 })).toThrow();
    expect(() => parseHttpBooking({ loadId: "LOAD-1", mc: "MC-1", agreedRate: 100, mcNumber: "MC-1" })).toThrow();
  });

  it("constructs separate safe detail output without internal fields", () => {
    const output = toPublicLoadDetail(load({ pickupDate: "2026-01-15", miles: 42, status: "AVAILABLE" }));
    expect(output).toEqual({
      loadId: "LOAD-1002",
      originState: "IL",
      destinationState: "GA",
      originCity: "Chicago",
      destinationCity: "Atlanta",
      equipmentType: "REEFER",
      rate: 2900,
      pickupDate: "2026-01-15",
      miles: 42,
      status: "AVAILABLE",
    });
    expect(output).not.toHaveProperty("notes");
    expect(toPublicLoadDetail(load({ miles: 10_001 }))).toMatchObject({ miles: 10_001 });
    expect(() => toPublicLoadDetail(load({ pickupDate: "2026-02-30" }))).toThrow();
  });

  it("diagnoses unsupported pickup date shapes without logging the value", () => {
    let caught: unknown;
    try {
      toPublicLoadDetail(load({ pickupDate: "2026-01-15T00:00:00Z" }));
    } catch (error) {
      caught = error;
    }

    expect(caught).toMatchObject({
      metadata: {
        mapping: {
          category: "invalid-field",
          field: "pickupDate",
          detail: "length",
          shape: "iso-datetime",
          observedLength: 20,
        },
      },
    });
    expect(JSON.stringify(caught)).not.toContain("2026-01-15T00:00:00Z");
  });

  it("normalizes documented compact pickup datetimes to public dates", () => {
    expect(toPublicLoadDetail(load({ pickupDate: "20260512080000" }))).toMatchObject({
      pickupDate: "2026-05-12",
    });
  });

  it("rejects invalid compact pickup datetime calendar values without logging the value", () => {
    let caught: unknown;
    try {
      toPublicLoadDetail(load({ pickupDate: "20261312080000" }));
    } catch (error) {
      caught = error;
    }

    expect(caught).toMatchObject({
      metadata: {
        mapping: {
          field: "pickupDate",
          detail: "calendar",
          shape: "compact-datetime",
          observedLength: 14,
        },
      },
    });
    expect(JSON.stringify(caught)).not.toContain("20261312080000");
  });

  it("preserves upstream order, bounds results, and preserves duplicates", () => {
    const results = mapPublicLoadSummaries([load(), load({ loadId: "LOAD-1001", rate: 2450 })], 1);
    expect(results.map((item) => item.loadId)).toEqual(["LOAD-1002"]);
    expect(mapPublicLoadSummaries([load(), load()], 10).map((item) => item.loadId)).toEqual(["LOAD-1002", "LOAD-1002"]);
  });

  it("maps reserved booking domain errors centrally", () => {
    expect(mapPublicError(new BookingConflictError())).toMatchObject({ status: 409, code: "BOOKING_CONFLICT" });
    expect(mapPublicError(new RateNotAcceptedError())).toMatchObject({ status: 422, code: "RATE_NOT_ACCEPTED" });
  });
});
