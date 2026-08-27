import { describe, expect, it } from "vitest";
import { LtmsResponseParser, parseResponse } from "../../src/tms/parser";
import { TmsProtocolError, TmsRemoteError, TmsResponseIncompleteError } from "../../src/tms/errors";
import { oneByteChunks } from "./test-helpers";

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

  it("redacts sensitive fields and keeps raw diagnostics bounded in UTF-8 bytes", () => {
    const response = parseResponse(`TOKEN:secret-token|MAX_BUY:2300|NOTES:internal|MSG:${"😀".repeat(200)}\r\nEND\r\n`);
    const rawLine = response.records[0]?.rawLine ?? "";
    expect(rawLine).toContain("TOKEN:[REDACTED]");
    expect(rawLine).toContain("MAX_BUY:[REDACTED]");
    expect(rawLine).toContain("NOTES:[REDACTED]");
    expect(rawLine).not.toContain("secret-token");
    expect(Buffer.byteLength(rawLine, "utf8")).toBeLessThanOrEqual(256);
  });

  it("rejects incomplete responses and framing errors", () => {
    expect(() => parseResponse("MSG:hello\r\n")).toThrow(/closed|complete/i);
    expect(() => parseResponse("MSG:hello\nEND\r\n")).toThrow();
    expect(() => parseResponse("ERR|MSG:no-code\r\n")).toThrow();
    expect(() => parseResponse("MSG:hello\r\nEND\r\nextra\r\n")).toThrow();
  });

  it("parses a response when every byte boundary splits a record and both terminal CRLFs", () => {
    const parser = new LtmsResponseParser();
    const response = "A:one|B:two\r\nC:three\r\nEND\r\n";
    let result;
    for (const chunk of oneByteChunks(response)) result = parser.push(chunk) ?? result;
    expect(result).toEqual({
      records: [
        { fields: { A: "one", B: "two" }, rawLine: "A:one|B:two" },
        { fields: { C: "three" }, rawLine: "C:three" },
      ],
      rawBytes: Buffer.byteLength(response),
    });
  });

  it("accepts END after records in arbitrary chunk boundaries and preserves only bounded byte accounting", () => {
    const response = "A:value\r\nEND\r\n";
    for (let split = 1; split < response.length; split += 1) {
      const parser = new LtmsResponseParser();
      expect(parser.push(Buffer.from(response.slice(0, split)))).toBeUndefined();
      expect(parser.push(Buffer.from(response.slice(split)))).toMatchObject({ rawBytes: Buffer.byteLength(response) });
    }
  });

  it.each([
    "A:value\nEND\r\n",
    "A:value\rEND\r\n",
    "A:value\r\nEND\n",
    "A:value\r\nEND\r",
  ])("rejects isolated or incomplete CR/LF framing %j", (response) => {
    expect(() => parseResponse(response)).toThrow();
  });

  it.each([":value\r\nEND\r\n", "A\r\nEND\r\n", "A:\r\nEND\r\n", "a:value\r\nEND\r\n", "A:value|A:again\r\nEND\r\n", "CMD:x\r\nEND\r\n", "AUTH:x\r\nEND\r\n"])(
    "rejects malformed, empty, duplicate, or reserved response fields %j",
    (response) => expect(() => parseResponse(response)).toThrow(TmsProtocolError),
  );

  it("allows colons inside values but never allows framing bytes inside a value", () => {
    expect(parseResponse("MSG:time:12:30\r\nEND\r\n").records[0]?.fields.MSG).toBe("time:12:30");
    expect(() => parseResponse("MSG:has\r\nnewline\r\nEND\r\n")).toThrow();
  });

  it("classifies an ERR terminal structurally and sanitizes its public error", () => {
    expect(() => parseResponse("A:value\r\nERR|CODE:AUTH_FAILED|MSG=secret-token\r\n")).toThrow(TmsProtocolError);
    try {
      parseResponse("A:value\r\nERR|CODE:AUTH_FAILED|MSG:secret-token\r\n");
    } catch (error) {
      expect(error).toBeInstanceOf(TmsRemoteError);
      expect(error).toMatchObject({ code: "AUTH_FAILED", metadata: { remoteCode: "AUTH_FAILED" } });
      expect(JSON.stringify(error)).not.toContain("secret-token");
    }
  });

  it.each(["ERR|MSG:no-code\r\n", "ERR|CODE:\r\n", "ERR|CODE:A|CODE:B\r\n", "ERR|CODE:A\r\nEND\r\n"])(
    "rejects incomplete or invalid ERR terminal %j",
    (response) => expect(() => parseResponse(response)).toThrow(),
  );

  it("classifies an ERR terminal without MSG as a protocol error", () => {
    expect(() => parseResponse("ERR|CODE:SERVER_ERROR\r\n")).toThrow(TmsProtocolError);
  });

  it("parses the official real DEBUG_ECHO marker and response AUTH field", () => {
    const response = parseResponse("ECHO|AUTH:OK|FIELDS_PARSED:3|MSG:HELLO\r\nEND\r\n");

    expect(response.records).toEqual([{
      recordType: "ECHO",
      fields: { AUTH: "OK", FIELDS_PARSED: "3", MSG: "HELLO" },
      rawLine: "ECHO|AUTH:[REDACTED]|FIELDS_PARSED:3|MSG:HELLO",
    }]);
  });

  it("rejects unknown terminals and anything after END", () => {
    expect(() => parseResponse("DONE\r\n")).toThrow(TmsProtocolError);
    expect(() => parseResponse("A:value\r\nEND\r\nDONE\r\n")).toThrow(TmsProtocolError);
  });

  it("rejects invalid UTF-8 and response byte overflow across chunks", () => {
    const parser = new LtmsResponseParser(5);
    parser.push(Buffer.from([0xff]));
    expect(() => parser.push(Buffer.from([13, 10]))).toThrow(TmsProtocolError);
    const limited = new LtmsResponseParser(9);
    expect(() => {
      limited.push(Buffer.from("A:1\r\n"));
      limited.push(Buffer.from("A:2\r\n"));
    }).toThrow(TmsProtocolError);
  });

  it("rejects data after a terminal and reports premature EOF exactly once", () => {
    const parser = new LtmsResponseParser();
    parser.push(Buffer.from("END\r\n"));
    expect(() => parser.push(Buffer.from("A:value\r\n"))).toThrow(TmsProtocolError);
    expect(() => parseResponse("A:value\r\n")).toThrow(TmsResponseIncompleteError);
  });
});
