import { describe, expect, it } from "vitest";
import { diagnoseLoadGetResponse } from "./real/load-structural-diagnostic";

describe("LOAD_GET structural diagnostic", () => {
  it("accepts additional colons inside values and recognizes END", () => {
    const diagnostic = diagnoseLoadGetResponse(Buffer.from("STATUS:OPEN|MSG:alpha:beta\r\nEND\r\n", "latin1"));

    expect(diagnostic.totalLineCount).toBe(2);
    expect(diagnostic.lines[0]).toMatchObject({
      classification: "RECORD",
      segmentCount: 2,
      invalidSegmentIndexes: [],
      fieldNames: ["MSG", "STATUS"],
      hasPipe: true,
      hasCR: true,
      hasLF: true,
      errorCategories: [],
    });
    expect(diagnostic.lines[1]).toMatchObject({ classification: "END", segmentCount: 1, fieldNames: [] });
  });

  it("reports malformed segments without exposing their values", () => {
    const diagnostic = diagnoseLoadGetResponse(Buffer.from("LOAD_ID:opaque|BROKEN|:hidden||RATE:value\r\nEND\r\n", "latin1"));

    expect(diagnostic.lines[0]).toMatchObject({
      classification: "INVALID",
      segmentCount: 5,
      invalidSegmentIndexes: [1, 2, 3],
      fieldNames: [],
      errorCategories: ["NO_COLON", "EMPTY_FIELD_NAME", "EMPTY_SEGMENT"],
    });
    expect(JSON.stringify(diagnostic)).not.toContain("opaque");
    expect(JSON.stringify(diagnostic)).not.toContain("hidden");
    expect(JSON.stringify(diagnostic)).not.toContain("LOAD_ID");
    expect(JSON.stringify(diagnostic)).not.toContain("RATE");
  });

  it("requires CRLF for END and flags data after a valid END", () => {
    const diagnostic = diagnoseLoadGetResponse(Buffer.from("END\nLOAD_ID:value\r\n", "latin1"));

    expect(diagnostic.lines[0]).toMatchObject({ classification: "INVALID", errorCategories: ["INVALID_TERMINATOR"] });
    expect(diagnostic.lines[1]).toMatchObject({ classification: "RECORD", fieldNames: [] });

    const afterEnd = diagnoseLoadGetResponse(Buffer.from("END\r\nLOAD_ID:value\r\n", "latin1"));
    expect(afterEnd.lines[1]).toMatchObject({ classification: "INVALID", errorCategories: ["RESPONSE_AFTER_END"] });
    expect(JSON.stringify(afterEnd)).not.toContain("LOAD_ID");
  });
});
