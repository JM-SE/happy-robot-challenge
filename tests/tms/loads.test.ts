import { describe, expect, it } from "vitest";
import { parseLoadDetailInput, parseLoadQueryInput, toLoadDetailFields, toLoadQueryFields, toPublicLoad } from "../../src/tms/loads";

describe("load DTOs and mappings", () => {
  it("normalizes search fields and maps them to the LTMS names", () => {
    const input = parseLoadQueryInput({ originState: " tx ", destinationCity: " Los Angeles ", equipmentType: "dry_van", maxResults: 2 });
    expect(input).toEqual({ originState: "TX", destinationCity: "Los Angeles", equipmentType: "DRY_VAN", maxResults: 2 });
    expect(toLoadQueryFields(input)).toEqual({ ORIG_STATE: "TX", DEST_CITY: "Los Angeles", EQTYPE: "DRY_VAN", MAX_RESULTS: 2 });
  });

  it.each([
    {},
    { maxResults: 1 },
    { originState: "TEX" },
    { originState: "TX", maxResults: 0 },
    { originState: "TX", maxResults: 51 },
    { originState: "TX", maxResults: 1.5 },
    { originState: "TX", unexpected: "field" },
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
});
