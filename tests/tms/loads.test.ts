import { describe, expect, it } from "vitest";
import { filterReturnedLoadsByPickupDate } from "../../src/tms/controlled-booking";
import { parseLoadDetailInput, parseLoadQueryInput, recordToLoadInternal, recordToPublicLoad, toLoadDetailFields, toLoadQueryFields, toPublicLoad } from "../../src/tms/loads";

describe("load DTOs and mappings", () => {
  it("normalizes search fields and maps them to the LTMS names", () => {
    const input = parseLoadQueryInput({ originState: " tx ", destinationCity: " Los Angeles ", equipmentType: "dry_van", maxResults: 2 });
    expect(input).toEqual({ originState: "TX", destinationCity: "Los Angeles", equipmentType: "DRY_VAN", maxResults: 2 });
    expect(toLoadQueryFields(input)).toEqual({ ORIG_STATE: "TX", DEST_CITY: "Los Angeles", EQTYPE: "DRY_VAN", MAX_RESULTS: 2 });
  });

  it("maps documented ZIP filters without imposing an undocumented width", () => {
    const input = parseLoadQueryInput({ originZip: " 75001 ", destinationZip: "90210-1234" });
    expect(input).toEqual({ originZip: "75001", destinationZip: "90210-1234" });
    expect(toLoadQueryFields(input)).toEqual({ ORIG_ZIP: "75001", DEST_ZIP: "90210-1234" });
  });

  it.each([
    {},
    { maxResults: 1 },
    { originState: "TEX" },
    { originState: "TX", maxResults: 0 },
    { originState: "TX", maxResults: 51 },
    { originState: "TX", maxResults: 1.5 },
    { originState: "TX", unexpected: "field" },
    { originState: "TX", pickupDate: "2026-09-01" },
    { originState: "TX", pickup_date: "2026-09-01" },
  ])("rejects invalid search input %j", (input) => {
    expect(() => parseLoadQueryInput(input)).toThrow();
  });

  it("requires a detail id and maps it to LOAD_ID", () => {
    const input = parseLoadDetailInput({ loadId: " LOAD-1001 " });
    expect(input).toEqual({ loadId: "LOAD-1001" });
    expect(toLoadDetailFields(input)).toEqual({ LOAD_ID: "LOAD-1001" });
    expect(() => parseLoadDetailInput({ loadId: "bad|id" })).toThrow();
  });

  it("keeps maxBuy internal when creating a public load", () => {
    const publicLoad = toPublicLoad({
      loadId: "LOAD-1", originState: "TX", destinationState: "CA", originCity: "Dallas", destinationCity: "LA",
      equipmentType: "DRY_VAN", rate: 100, notes: "note", maxBuy: 90,
    });
    expect(publicLoad).not.toHaveProperty("maxBuy");
  });

  it("maps read-only records without requiring or exposing MAX_BUY", () => {
    const publicLoad = recordToPublicLoad({
      fields: {
        LOAD_ID: "LOAD-REAL",
        ORIG_STATE: "TX",
        DEST_STATE: "CA",
        ORIG_CITY: "Dallas",
        DEST_CITY: "Los Angeles",
        EQTYPE: "DRY_VAN",
        RATE: "0002450",
        NOTES: "",
      },
    });

    expect(publicLoad).toEqual({
      loadId: "LOAD-REAL",
      originState: "TX",
      destinationState: "CA",
      originCity: "Dallas",
      destinationCity: "Los Angeles",
      equipmentType: "DRY_VAN",
      rate: 2450,
      notes: "",
    });
    expect(publicLoad).not.toHaveProperty("maxBuy");
  });

  it("maps optional operational fields and omits invalid optional miles", () => {
    const record = {
      rawLine: "LOAD_ID:LOAD-REAL|RATE:2450",
      fields: {
        LOAD_ID: "LOAD-REAL",
        ORIG_STATE: "TX",
        DEST_STATE: "CA",
        ORIG_CITY: "Dallas",
        DEST_CITY: "Los Angeles",
        EQTYPE: "DRY_VAN",
        RATE: "2450",
        PICKUP_DT: "2026-09-01",
        MILES: "not-a-number",
        STATUS: "AVAILABLE",
      },
    };

    expect(recordToPublicLoad(record)).toMatchObject({ pickupDate: "2026-09-01", status: "AVAILABLE" });
    expect(recordToPublicLoad(record)).not.toHaveProperty("miles");
    expect(recordToLoadInternal(record)).not.toHaveProperty("maxBuy");
  });

  it("rejects oversized query text before framing", () => {
    expect(() => parseLoadQueryInput({ originCity: "x".repeat(8193) })).toThrow(/non-empty/i);
  });

  it("filters only returned loads by pickup date without changing the wire query", () => {
    const loads = [
      { loadId: "LOAD-1", originState: "TX", destinationState: "CA", originCity: "Dallas", destinationCity: "Los Angeles", equipmentType: "DRY_VAN", rate: 100, notes: "", pickupDate: "2026-09-01" },
      { loadId: "LOAD-2", originState: "TX", destinationState: "CA", originCity: "Dallas", destinationCity: "Los Angeles", equipmentType: "DRY_VAN", rate: 110, notes: "" },
      { loadId: "LOAD-3", originState: "TX", destinationState: "CA", originCity: "Dallas", destinationCity: "Los Angeles", equipmentType: "DRY_VAN", rate: 120, notes: "", pickupDate: "2026-09-02" },
    ];

    expect(filterReturnedLoadsByPickupDate(loads, (pickupDate) => pickupDate === "2026-09-01").map((load) => load.loadId)).toEqual(["LOAD-1"]);
  });
});
