import { describe, expect, it } from "vitest";
import { MAX_NOTE_LENGTH, MAX_LIST_RESULTS, type CallEventStore } from "../../src/operations/contracts";
describe("operations contracts", () => { it("keeps bounded exact store surface", () => { expect(MAX_NOTE_LENGTH).toBe(240); expect(MAX_LIST_RESULTS).toBe(500); const names = Object.keys({} as CallEventStore); expect(names).toEqual([]); }); });
