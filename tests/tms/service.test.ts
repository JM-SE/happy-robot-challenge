import { describe, expect, it } from "vitest";
import { getLoad, searchLoads, type LoadTmsPort } from "../../src/tms/service";
import { parseResponse } from "../../src/tms/parser";

const response = parseResponse("LOAD_ID:LOAD-1|ORIG_STATE:TX|DEST_STATE:CA|ORIG_CITY:Dallas|DEST_CITY:Los Angeles|EQTYPE:DRY_VAN|RATE:100|NOTES: note |MAX_BUY:90\r\nEND\r\n");
const port: LoadTmsPort = { execute: async () => response };

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
});
