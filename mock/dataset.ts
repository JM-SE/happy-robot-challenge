import type { LoadInternal } from "../src/tms/types";

export const LOAD_DATASET: readonly LoadInternal[] = Object.freeze([
  Object.freeze({
    loadId: "LOAD-1001",
    originState: "TX",
    destinationState: "CA",
    originCity: "Dallas",
    destinationCity: "Los Angeles",
    equipmentType: "DRY_VAN",
    rate: 2450,
    notes: "Appointment required",
    maxBuy: 2300,
  }),
  Object.freeze({
    loadId: "LOAD-1002",
    originState: "IL",
    destinationState: "GA",
    originCity: "Chicago",
    destinationCity: "Atlanta",
    equipmentType: "REEFER",
    rate: 3100,
    notes: "",
    maxBuy: 2950,
  }),
]);
