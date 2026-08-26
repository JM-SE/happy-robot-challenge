import { describe, expect, it } from "vitest";
import { buildRequest } from "../../src/tms/protocol";

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
});
