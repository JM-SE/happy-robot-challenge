import { describe, expect, it } from "vitest";
import { LtmsResponseParser, parseResponse } from "../../src/tms/parser";
import { TmsRemoteError } from "../../src/tms/errors";

describe("LtmsResponseParser", () => {
  it("parses records split across chunks and END separately", () => {
    const parser = new LtmsResponseParser();
    expect(parser.push(Buffer.from("MSG:hel"))).toBeUndefined();
    expect(parser.push(Buffer.from("lo|FIELD_COUNT:3\r\nEN"))).toBeUndefined();
    expect(parser.push(Buffer.from("D\r\n"))).toEqual({
      records: [{ fields: { MSG: "hello", FIELD_COUNT: "3" }, rawLine: "MSG:hello|FIELD_COUNT:3" }],
      rawBytes: 30,
    });
  });

  it("accepts an empty response", () => {
    expect(parseResponse("END\r\n").records).toEqual([]);
  });

  it("parses multiple records in one chunk, independent of field order and with ASCII padding", () => {
    const response = parseResponse(" LOAD_ID : LOAD-1 | RATE : 100 \r\nRATE:200|LOAD_ID:LOAD-2\r\nEND\r\n");
    expect(response.records.map((record) => record.fields)).toEqual([
      { LOAD_ID: "LOAD-1", RATE: "100" },
      { RATE: "200", LOAD_ID: "LOAD-2" },
    ]);
  });

  it("returns structured remote errors, including unknown codes", () => {
    expect(() => parseResponse("ERR|CODE:SOMETHING_NEW|MSG:nope\r\n")).toThrow(TmsRemoteError);
    try {
      parseResponse("ERR|CODE:SOMETHING_NEW|MSG:nope\r\n");
    } catch (error) {
      expect(error).toMatchObject({ type: "TMS_REMOTE", code: "SOMETHING_NEW", metadata: { remoteCode: "SOMETHING_NEW" } });
    }
  });

  it("rejects incomplete responses and framing errors", () => {
    expect(() => parseResponse("MSG:hello\r\n")).toThrow(/closed|complete/i);
    expect(() => parseResponse("MSG:hello\nEND\r\n")).toThrow();
    expect(() => parseResponse("ERR|MSG:no-code\r\n")).toThrow();
    expect(() => parseResponse("MSG:hello\r\nEND\r\nextra\r\n")).toThrow();
  });
});
