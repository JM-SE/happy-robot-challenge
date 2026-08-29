import { describe, expect, it } from "vitest";
import type { CallRecord } from "../../src/operations/contracts";
import { createDemoFixtures } from "../../src/operations/fixtures";
import { detail, listItem } from "../../src/operations/response-mapper";

describe("operations response mappers", () => {
  it("keeps notes and handoff reasons detail-only", () => {
    const record = { ...createDemoFixtures()[0], notes: "safe note", handoffReason: "Senior review requested" } as unknown as CallRecord;
    const list = listItem(record);
    const full = detail(record);
    expect(list).not.toHaveProperty("notes");
    expect(list).not.toHaveProperty("handoffReason");
    expect(full).toMatchObject({ notes: "safe note", handoffReason: "Senior review requested" });
  });

  it("does not reflect internal record fields", () => {
    const record = { ...createDemoFixtures()[0], MAX_BUY: 1, rawTranscript: "drop", secret: "drop" } as never;
    const serialized = JSON.stringify(detail(record));
    expect(serialized).not.toContain("MAX_BUY");
    expect(serialized).not.toContain("rawTranscript");
    expect(serialized).not.toContain("secret");
  });
});
