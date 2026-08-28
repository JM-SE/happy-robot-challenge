import { afterEach, describe, expect, it, vi } from "vitest";
import { TmsClient } from "../../src/tms/client";
import { TmsConnectionError, TmsProtocolError, TmsRemoteError, TmsResponseIncompleteError, TmsTimeoutError } from "../../src/tms/errors";
import { expectNoSocketListeners, socketConnect, TestSocket, testConfig } from "./test-helpers";

afterEach(() => {
  vi.useRealTimers();
});

describe("TmsClient", () => {
  it("uses a new socket, writes once, parses response and closes", async () => {
    const sockets: TestSocket[] = [];
    const connect = () => {
      const socket = new TestSocket();
      sockets.push(socket);
       queueMicrotask(() => { socket.emit("connect"); socket.emit("data", Buffer.from("MSG:hello\r\nEND\r\n")); socket.emit("end"); });
      return socket;
    };
    const client = new TmsClient(testConfig({ authToken: "token" }), connect);
    await expect(client.execute({ command: "DEBUG_ECHO", fields: { MSG: "hello" } })).resolves.toMatchObject({ records: [{ fields: { MSG: "hello" } }] });
    await expect(client.execute({ command: "DEBUG_ECHO", fields: { MSG: "again" } })).resolves.toBeDefined();
    expect(sockets).toHaveLength(2);
    expect(sockets[0].writes).toHaveLength(1);
    expect(sockets[0].writes[0].toString()).toContain("CMD:DEBUG_ECHO|AUTH:token|MSG:hello\r\n");
    expect(sockets[0].ended).toBe(true);
    sockets[0].emit("close");
    expect(sockets[0].endCalls).toBe(1);
    expect(sockets[0].destroyCalls).toBe(0);
    expectNoSocketListeners(sockets[0]);
  });

  it("times out and destroys a socket that never connects", async () => {
    vi.useFakeTimers();
    const socket = new TestSocket();
    const client = new TmsClient(testConfig({ connectTimeoutMs: 20 }), socketConnect(socket));
    const pending = client.execute({ command: "DEBUG_ECHO", fields: { MSG: "hello" } });
    const rejection = expect(pending).rejects.toBeInstanceOf(TmsTimeoutError);
    await vi.advanceTimersByTimeAsync(20);
    await rejection;
    expect(socket.destroyed).toBe(true);
    expect(socket.destroyCalls).toBe(1);
    socket.emit("connect");
    socket.emit("data", Buffer.from("MSG:late\r\nEND\r\n"));
    expectNoSocketListeners(socket);
  });

  it("uses one write per request and ignores duplicate connect events", async () => {
    const socket = new TestSocket();
    const client = new TmsClient(testConfig(), socketConnect(socket));
    const pending = client.execute({ command: "DEBUG_ECHO", fields: { MSG: "hello" } });
   socket.emit("connect");
   socket.emit("connect");
   socket.emit("data", Buffer.from("MSG:hello\r\nEND\r\n"));
    socket.emit("end");
    await expect(pending).resolves.toBeDefined();
    expect(socket.writes).toHaveLength(1);
    expect(socket.endCalls).toBe(1);
  });

  it("times out a connected socket waiting for response, clears all listeners, and does not retry", async () => {
    vi.useFakeTimers();
    const socket = new TestSocket();
    const connect = vi.fn(socketConnect(socket));
    const client = new TmsClient(testConfig({ responseTimeoutMs: 15 }), connect);
    const pending = client.execute({ command: "DEBUG_ECHO", fields: { MSG: "hello" } });
    const rejection = expect(pending).rejects.toMatchObject({ type: "TMS_TIMEOUT", code: "RESPONSE_TIMEOUT", stage: "response" });
    socket.emit("connect");
    await vi.advanceTimersByTimeAsync(15);
    await rejection;
    expect(connect).toHaveBeenCalledTimes(1);
    expect(socket.writes).toHaveLength(1);
    expect(socket.destroyCalls).toBe(1);
    expectNoSocketListeners(socket);
  });

  it("marks a booking timeout as non-retryable and does not retry the request", async () => {
    vi.useFakeTimers();
    const socket = new TestSocket();
    const connect = vi.fn(socketConnect(socket));
    const client = new TmsClient(testConfig({ responseTimeoutMs: 15 }), connect);
    const pending = client.execute({ command: "LOAD_BOOK", fields: { LOAD_ID: "LOAD-1001", MC_NUM: "12345", AGREED_RATE: 2200 } });
    let error: unknown;
    const settled = pending.catch((caught) => {
      error = caught;
    });
    socket.emit("connect");
    await vi.advanceTimersByTimeAsync(15);
    await settled;
    expect(error).toMatchObject({
      type: "TMS_TIMEOUT",
      code: "RESPONSE_TIMEOUT",
      retryable: false,
      stage: "response",
    });
    expect(connect).toHaveBeenCalledTimes(1);
    expect(socket.writes).toHaveLength(1);
    expect(socket.destroyCalls).toBe(1);
    expect(error).toMatchObject({ metadata: { writeAttempted: true, writeDisposition: "sent" } });
    expect(error).toMatchObject({ metadata: { command: "LOAD_BOOK" } });
  });

  it("settles once for error followed by close and always destroys the socket", async () => {
    const socket = new TestSocket();
    const client = new TmsClient(testConfig(), socketConnect(socket));
    const pending = client.execute({ command: "DEBUG_ECHO", fields: { MSG: "hello" } });
    socket.emit("connect");
    socket.emit("error", new Error("remote socket error"));
    socket.emit("close");
    await expect(pending).rejects.toMatchObject({ type: "TMS_CONNECTION", stage: "response" });
    expect(socket.destroyCalls).toBe(1);
    expect(socket.endCalls).toBe(0);
    expectNoSocketListeners(socket);
  });

  it("classifies an error before connect as a connect failure and ignores the following close", async () => {
    const socket = new TestSocket();
    const client = new TmsClient(testConfig(), socketConnect(socket));
    const pending = client.execute({ command: "DEBUG_ECHO", fields: { MSG: "hello" } });
    socket.emit("error", new Error("refused"));
    socket.emit("close");
    await expect(pending).rejects.toMatchObject({ type: "TMS_CONNECTION", stage: "connect" });
    expect(socket.destroyCalls).toBe(1);
    expectNoSocketListeners(socket);
  });

  it("settles once for end followed by close and reports incomplete response", async () => {
    const socket = new TestSocket();
    const client = new TmsClient(testConfig(), socketConnect(socket));
    const pending = client.execute({ command: "DEBUG_ECHO", fields: { MSG: "hello" } });
    socket.emit("connect");
    socket.emit("data", Buffer.from("MSG:partial\r\n"));
    socket.emit("end");
    socket.emit("close");
    await expect(pending).rejects.toBeInstanceOf(TmsResponseIncompleteError);
    expect(socket.destroyCalls).toBe(1);
    expectNoSocketListeners(socket);
  });

  it("ignores data and socket errors after timeout instead of resolving or settling twice", async () => {
    vi.useFakeTimers();
    const socket = new TestSocket();
    const client = new TmsClient(testConfig({ responseTimeoutMs: 10 }), socketConnect(socket));
    const pending = client.execute({ command: "DEBUG_ECHO", fields: { MSG: "hello" } });
    const rejection = expect(pending).rejects.toMatchObject({ code: "RESPONSE_TIMEOUT" });
    socket.emit("connect");
    await vi.advanceTimersByTimeAsync(10);
    socket.emit("data", Buffer.from("MSG:late\r\nEND\r\n"));
    socket.emit("error", new Error("late error"));
    await rejection;
    expect(socket.destroyCalls).toBe(1);
    expectNoSocketListeners(socket);
  });

  it("preserves protocol classification for incomplete CRLF at EOF", async () => {
    const socket = new TestSocket();
    const client = new TmsClient(testConfig(), socketConnect(socket));
    const pending = client.execute({ command: "DEBUG_ECHO", fields: { MSG: "hello" } });
    socket.emit("connect");
    socket.emit("data", Buffer.from("MSG:partial\r"));
    socket.emit("end");
    await expect(pending).rejects.toMatchObject({ type: "TMS_PROTOCOL", code: "PROTOCOL_ERROR" });
    expectNoSocketListeners(socket);
  });

  it("classifies a close before connect as a connect failure", async () => {
    const socket = new TestSocket();
    const client = new TmsClient(testConfig(), socketConnect(socket));
    const pending = client.execute({ command: "DEBUG_ECHO", fields: { MSG: "hello" } });
    socket.emit("close");
    await expect(pending).rejects.toMatchObject({ type: "TMS_CONNECTION", stage: "connect", metadata: { writeDisposition: "not-sent" } });
    expect(socket.destroyCalls).toBe(0);
    expectNoSocketListeners(socket);
  });

  it("rejects trailing bytes delivered after END on the socket seam", async () => {
    const socket = new TestSocket();
    const client = new TmsClient(testConfig(), socketConnect(socket));
    const pending = client.execute({ command: "DEBUG_ECHO", fields: { MSG: "hello" } });
    socket.emit("connect");
    socket.emit("data", Buffer.from("MSG:hello\r\nEND\r\n"));
    socket.emit("data", Buffer.from("TRAILING:bytes\r\n"));
    let error: unknown;
    try {
      await pending;
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(TmsProtocolError);
  });

  it("maps write errors to the write stage without retrying", async () => {
    const socket = new TestSocket();
    socket.writeError = new Error("write failed");
    const connect = vi.fn(socketConnect(socket));
    const client = new TmsClient(testConfig(), connect);
    const pending = client.execute({ command: "DEBUG_ECHO", fields: { MSG: "hello" } });
    socket.emit("connect");
    await expect(pending).rejects.toMatchObject({ type: "TMS_CONNECTION", stage: "write", metadata: { writeDisposition: "unknown" } });
    expect(connect).toHaveBeenCalledTimes(1);
    expect(socket.writes).toHaveLength(1);
    expect(socket.destroyCalls).toBe(1);
    expectNoSocketListeners(socket);
  });

  it("preserves parse and remote failures, closes once, and never retries booking", async () => {
    for (const [payload, expected] of [
      ["NOT_A_FIELD\r\nEND\r\n", TmsProtocolError],
      ["ERR|CODE:ALREADY_BOOKED|MSG:private details\r\n", TmsRemoteError],
    ] as const) {
      const socket = new TestSocket();
      const connect = vi.fn(socketConnect(socket));
      const client = new TmsClient(testConfig(), connect);
      const pending = client.execute({ command: "LOAD_BOOK", fields: { LOAD_ID: "LOAD-1001", MC_NUM: "12345", AGREED_RATE: 2200 } });
      socket.emit("connect");
      socket.emit("data", Buffer.from(payload));
      await expect(pending).rejects.toBeInstanceOf(expected);
      expect(connect).toHaveBeenCalledTimes(1);
      expect(socket.destroyCalls).toBe(1);
      expectNoSocketListeners(socket);
    }
  });

  it("keeps logs bounded and excludes credentials and wire fields", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const socket = new TestSocket();
    const client = new TmsClient(testConfig({ authToken: "super-secret" }), socketConnect(socket));
    const pending = client.execute({ command: "DEBUG_ECHO", fields: { MSG: "safe-message" } });
    socket.emit("connect");
    socket.emit("data", Buffer.from("MSG:safe-message\r\nEND\r\n"));
    socket.emit("end");
    await pending;
    expect(JSON.stringify(log.mock.calls)).not.toContain("super-secret");
    expect(JSON.stringify(log.mock.calls)).not.toContain("safe-message");
    expect(JSON.stringify(log.mock.calls)).not.toContain("AUTH");
    expect(log).toHaveBeenCalledTimes(1);
  });

  it("normalizes a synchronous connect failure and leaves no socket to leak", async () => {
    const client = new TmsClient(testConfig(), () => { throw new Error("connect failed"); });
    await expect(client.execute({ command: "DEBUG_ECHO", fields: { MSG: "hello" } })).rejects.toBeInstanceOf(TmsConnectionError);
  });
});
