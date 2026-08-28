import { describe, expect, it } from "vitest";
import { getLoad, searchLoads, type LoadTmsPort } from "../../src/tms/service";
import { recordToBookingPublic, toBookLoadFields } from "../../src/tms/booking";
import type { BookLoadInput, BookingPublic } from "../../src/tms/types";
import { parseResponse } from "../../src/tms/parser";
import { TmsUpstreamError } from "../../src/tms/errors";

const response = parseResponse("LOAD_ID:LOAD-1|ORIG_STATE:TX|DEST_STATE:CA|ORIG_CITY:Dallas|DEST_CITY:Los Angeles|EQTYPE:DRY_VAN|RATE:100|NOTES: note |MAX_BUY:90\r\nEND\r\n");
const port: LoadTmsPort = { execute: async () => response };
const bookingResponse = parseResponse("LOAD_ID:LOAD-1|MC_NUM:12345|AGREED_RATE:100|BOOKING_REF:BOOK-1|BOOKED_AT:2026-01-01T00:00:00.000Z\r\nEND\r\n");

// Test-only response mapping for the low-level service contract. Production
// booking must use ControlledBookingWorkflow, never this direct seam.
async function bookLoadTestOnly(input: BookLoadInput, port: LoadTmsPort): Promise<BookingPublic> {
  const response = await port.execute({ command: "LOAD_BOOK", fields: toBookLoadFields(input) });
  if (!response.records.length) throw Object.assign(new Error("Booking response was empty."), { type: "TMS_REMOTE", code: "SERVER_ERROR", retryable: false });
  if (response.records.length !== 1) throw new Error("LOAD_BOOK response must contain exactly one record.");
  return recordToBookingPublic(response.records[0]!);
}

describe("read-only load service", () => {
  it("maps query records to public loads", async () => {
    const loads = await searchLoads({ originState: "TX" }, port);
    expect(loads).toEqual([{
      loadId: "LOAD-1", originState: "TX", destinationState: "CA", originCity: "Dallas", destinationCity: "Los Angeles",
      equipmentType: "DRY_VAN", rate: 100, notes: "note",
    }]);
    expect(JSON.stringify(loads)).not.toContain("MAX_BUY");
  });

  it("rejects a detail response without a record", async () => {
    await expect(getLoad({ loadId: "missing" }, { execute: async () => parseResponse("END\r\n") })).rejects.toMatchObject({ code: "UNKNOWN_LOAD" });
  });

  it("rejects a detail response containing multiple records", async () => {
    const multiple = { ...response, records: [response.records[0]!, response.records[0]!] };
    await expect(getLoad({ loadId: "LOAD-1" }, { execute: async () => multiple })).rejects.toThrow();
  });

  it("rejects a load response that is missing a required field", async () => {
    const malformed = parseResponse("LOAD_ID:LOAD-1|ORIG_STATE:TX|DEST_STATE:CA|ORIG_CITY:Dallas|DEST_CITY:Los Angeles|EQTYPE:DRY_VAN|MAX_BUY:90\r\nEND\r\n");
    await expect(searchLoads({ originState: "TX" }, { execute: async () => malformed })).rejects.toBeInstanceOf(TmsUpstreamError);
  });

  it("rejects an empty booking response", async () => {
    await expect(bookLoadTestOnly(
      { loadId: "LOAD-1", mcNumber: "12345", agreedRate: 100 },
      { execute: async () => parseResponse("END\r\n") },
    )).rejects.toMatchObject({ type: "TMS_REMOTE", code: "SERVER_ERROR", retryable: false });
  });

  it("rejects a booking response containing multiple records", async () => {
    const multiple = { ...bookingResponse, records: [bookingResponse.records[0]!, bookingResponse.records[0]!] };
    await expect(bookLoadTestOnly(
      { loadId: "LOAD-1", mcNumber: "12345", agreedRate: 100 },
      { execute: async () => multiple },
    )).rejects.toThrow();
  });

  it("rejects a booking response that is missing a required field", async () => {
    const malformed = parseResponse("LOAD_ID:LOAD-1|MC_NUM:12345|AGREED_RATE:100|BOOKED_AT:2026-01-01T00:00:00.000Z\r\nEND\r\n");
    await expect(bookLoadTestOnly(
      { loadId: "LOAD-1", mcNumber: "12345", agreedRate: 100 },
      { execute: async () => malformed },
    )).rejects.toBeInstanceOf(TmsUpstreamError);
  });
});
