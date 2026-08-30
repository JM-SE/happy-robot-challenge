import { describe, expect, it } from "vitest";
import { responseToEchoResult } from "../../src/tms/echo";
import { parseResponse } from "../../src/tms/parser";

describe("DEBUG_ECHO response mapper", () => {
  it("preserves the Phase 1 mock response shape", () => {
    expect(responseToEchoResult(parseResponse("MSG:hello|FIELD_COUNT:3\r\nEND\r\n"))).toEqual({
      message: "hello",
      fieldCount: 3,
    });
  });

  it("maps the official real response shape to the public contract", () => {
    expect(responseToEchoResult(parseResponse("ECHO|AUTH:OK|FIELDS_PARSED:6|MSG:probe-7\r\nEND\r\n"))).toEqual({
      message: "probe-7",
      fieldCount: 6,
    });
  });

  it("accepts optional auth, message, and unknown fields", () => {
    expect(responseToEchoResult(parseResponse("ECHO|EXTRA:x|AUTH:BAD|FIELDS_PARSED:3\r\nEND\r\n"))).toEqual({ message: "", fieldCount: 3 });
  });

  it.each([
    "ECHO|AUTH:OK|FIELDS_PARSED:three|MSG:HELLO\r\nEND\r\n",
  ])("rejects invalid real echo shapes %j", (wire) => {
    expect(() => responseToEchoResult(parseResponse(wire))).toThrow();
  });
});
