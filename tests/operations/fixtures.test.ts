import { describe, expect, it } from "vitest";
import { createDemoFixtures } from "../../src/operations/fixtures";
describe("demo fixtures", () => { it("provides eight deterministic labeled records", () => { const first = createDemoFixtures(); const second = createDemoFixtures(); expect(first).toHaveLength(8); expect(first).toEqual(second); expect(first.every((record) => record.source === "fixture" && record.mode === "demo")).toBe(true); }); });
