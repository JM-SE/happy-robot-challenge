import { describe, expect, it } from "vitest";
import { buildRequest } from "../../src/tms/protocol";
import { TmsValidationError } from "../../src/tms/errors";

describe("buildRequest", () => {
  it("serializes CMD first, AUTH second, fields and CRLF", () => {
    expect(buildRequest({ command: "DEBUG_ECHO", authToken: "secret", fields: { MSG: "hello" } }).toString()).toBe(
      "CMD:DEBUG_ECHO|AUTH:secret|MSG:hello\r\n",
    );
  });

  it("allows syntactically valid unknown commands", () => {
    expect(buildRequest({ command: "FUTURE_CMD", authToken: "token" }).toString()).toContain("CMD:FUTURE_CMD");
  });

  it("serializes read-only load commands with exact field names", () => {
    expect(buildRequest({
      command: "LOAD_QUERY",
      authToken: "token",
      fields: { ORIG_STATE: "TX", DEST_CITY: "Los Angeles", EQTYPE: "DRY_VAN", MAX_RESULTS: 2 },
    }).toString()).toBe("CMD:LOAD_QUERY|AUTH:token|ORIG_STATE:TX|DEST_CITY:Los Angeles|EQTYPE:DRY_VAN|MAX_RESULTS:2\r\n");
    expect(buildRequest({ command: "LOAD_GET", authToken: "token", fields: { LOAD_ID: "LOAD-1001" } }).toString()).toBe(
      "CMD:LOAD_GET|AUTH:token|LOAD_ID:LOAD-1001\r\n",
    );
  });

  it.each(["", "bad-command", "DEBUG ECHO"]) ("rejects invalid command %j", (command) => {
    expect(() => buildRequest({ command, authToken: "token" })).toThrow();
  });

  it.each(["", "a|b", "a\rb", "a\nb"]) ("rejects invalid values %j", (value) => {
    expect(() => buildRequest({ command: "DEBUG_ECHO", authToken: value })).toThrow();
    expect(() => buildRequest({ command: "DEBUG_ECHO", authToken: "token", fields: { MSG: value } })).toThrow();
  });

  it("rejects reserved fields and oversized frames by bytes", () => {
    expect(() => buildRequest({ command: "DEBUG_ECHO", authToken: "token", fields: { AUTH: "oops" } })).toThrow();
    expect(() => buildRequest({ command: "DEBUG_ECHO", authToken: "token", fields: { MSG: "é" } }, 22)).toThrow();
  });

  it.each(["A-B", "a", "1COMMAND", "CMD:DEBUG_ECHO", "DEBUG_ECHO\r", "DEBUG_ECHO\n"])(
    "rejects command names that could alter framing %j",
    (command) => expect(() => buildRequest({ command, authToken: "token" })).toThrow(TmsValidationError),
  );

  it.each(["", "a|b", "a\rb", "a\nb", "a\r\nb"])("rejects every illegal field value %j", (value) => {
    expect(() => buildRequest({ command: "DEBUG_ECHO", authToken: "token", fields: { MSG: value } })).toThrow(TmsValidationError);
  });

  it.each(["CMD", "AUTH", "cmd", "bad-name", "FIELD\n"])("rejects invalid or reserved field names %j", (name) => {
    expect(() => buildRequest({ command: "DEBUG_ECHO", authToken: "token", fields: { [name]: "value" } })).toThrow(TmsValidationError);
  });

  it("uses UTF-8 byte length, accepts the exact limit, and keeps protocol ordering immutable", () => {
    const frame = buildRequest({ command: "UNKNOWN_CMD", authToken: "tökën", fields: { MSG: "😀" } });
    expect(buildRequest({ command: "UNKNOWN_CMD", authToken: "tökën", fields: { MSG: "😀" } }, frame.byteLength)).toEqual(frame);
    expect(() => buildRequest({ command: "UNKNOWN_CMD", authToken: "tökën", fields: { MSG: "😀" } }, frame.byteLength - 1)).toThrow();
    expect(frame.toString("utf8").startsWith("CMD:UNKNOWN_CMD|AUTH:tökën|MSG:😀\r\n")).toBe(true);
    expect(frame.subarray(-2).equals(Buffer.from("\r\n"))).toBe(true);
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])("rejects an invalid byte limit %j", (limit) => {
    expect(() => buildRequest({ command: "DEBUG_ECHO", authToken: "token" }, limit)).toThrow(TmsValidationError);
  });

  it("requires a non-empty auth token even when called through an untyped boundary", () => {
    expect(() => buildRequest({ command: "DEBUG_ECHO", authToken: undefined as unknown as string })).toThrow(TmsValidationError);
  });

  it.each([true, false, null, {}, []])("rejects unsupported field values at the protocol boundary: %j", (value) => {
    expect(() => buildRequest({
      command: "DEBUG_ECHO",
      authToken: "token",
      fields: { MSG: value } as never,
    })).toThrow(TmsValidationError);
  });
});
