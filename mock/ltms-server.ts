import net from "node:net";
import { BookingStateError, bookLoadInState, createLoadBookingState, LOAD_DATASET, type LoadBookingState } from "./dataset";
import { applyPreDispatchFault, resolveMockFault, writePostDispatchResponse, type MockFaultScenario, type MockTimer } from "./scenarios";
import { DEFAULT_TMS_FRAME_BYTES } from "../src/tms/limits";
import type { LoadInternal } from "../src/tms/types";

const IDENTIFIER = /^[A-Z][A-Z0-9_]*$/;

export interface MockLtmsOptions {
  host?: string;
  port?: number;
  authToken?: string;
  bookingServerError?: boolean;
  fault?: MockFaultScenario;
  faultScenario?: MockFaultScenario;
  faultDelayMs?: number;
  fragmentSize?: number;
}

export interface MockLtmsServer {
  readonly connectionCount: number;
  readonly requestCount: number;
  readonly dispatchCount: number;
  start(): Promise<{ host: string; port: number }>;
  stop(): Promise<void>;
}

function errorFrame(code: string, message: string): Buffer {
  return Buffer.from(`ERR|CODE:${code}|MSG:${message}\r\n`, "utf8");
}

function responseFrame(message: string, fieldCount: number): Buffer {
  return Buffer.from(`MSG:${message}|FIELD_COUNT:${fieldCount}\r\nEND\r\n`, "utf8");
}

function loadFrame(load: LoadInternal, reverseOrder: boolean): Buffer {
  const fields = [
    ["LOAD_ID", load.loadId],
    ["ORIG_STATE", load.originState],
    ["DEST_STATE", load.destinationState],
    ["ORIG_CITY", load.originCity],
    ["DEST_CITY", load.destinationCity],
    ["EQTYPE", load.equipmentType],
    ["RATE", String(load.rate)],
    ["NOTES", load.notes],
    ["MAX_BUY", String(load.maxBuy)],
  ];
  if (reverseOrder) fields.reverse();
  return Buffer.from(`${fields.map(([name, value]) => `${name}:${value}`).join("|")}\r\n`, "utf8");
}

function loadErrorFrame(code: string, message: string): Buffer {
  return errorFrame(code, message);
}

function bookingFrame(booking: { loadId: string; mcNumber: string; agreedRate: number; bookingRef: string; bookedAt: string }): Buffer {
  return Buffer.from(
    `LOAD_ID:${booking.loadId}|MC_NUM:${booking.mcNumber}|AGREED_RATE:${booking.agreedRate}|BOOKING_REF:${booking.bookingRef}|BOOKED_AT:${booking.bookedAt}\r\nEND\r\n`,
    "utf8",
  );
}

function loadQueryResponse(fields: Map<string, string>): Buffer {
  const matches = LOAD_DATASET.filter((load) => {
    const matchesValue = (field: string, value: string, normalize = false) => {
      const expected = normalize ? value.toUpperCase() : value.toLowerCase();
      const actual = load[field as keyof LoadInternal];
      if (typeof actual !== "string") return false;
      return (normalize ? actual.toUpperCase() : actual.toLowerCase()) === expected;
    };
    if (fields.has("ORIG_STATE") && !matchesValue("originState", fields.get("ORIG_STATE") ?? "", true)) return false;
    if (fields.has("DEST_STATE") && !matchesValue("destinationState", fields.get("DEST_STATE") ?? "", true)) return false;
    if (fields.has("ORIG_CITY") && !matchesValue("originCity", fields.get("ORIG_CITY") ?? "")) return false;
    if (fields.has("DEST_CITY") && !matchesValue("destinationCity", fields.get("DEST_CITY") ?? "")) return false;
    if (fields.has("ORIG_ZIP") && !matchesValue("originZip", fields.get("ORIG_ZIP") ?? "")) return false;
    if (fields.has("DEST_ZIP") && !matchesValue("destinationZip", fields.get("DEST_ZIP") ?? "")) return false;
    if (fields.has("EQTYPE") && !matchesValue("equipmentType", fields.get("EQTYPE") ?? "", true)) return false;
    return true;
  });
  const maxResults = Number(fields.get("MAX_RESULTS") ?? matches.length);
  const selected = matches.slice(0, Number.isInteger(maxResults) && maxResults > 0 ? maxResults : matches.length);
  return Buffer.concat([...selected.map((load, index) => loadFrame(load, index % 2 === 1)), Buffer.from("END\r\n")]);
}

function dispatchCommand(fields: Map<string, string>, bookingState: LoadBookingState[], bookingServerError: boolean): Buffer {
  const command = fields.get("CMD");
  if (command === "DEBUG_ECHO" && !fields.has("MSG")) return errorFrame("MISSING_FIELD", "MSG is required");
  if (command === "DEBUG_ECHO") return responseFrame(fields.get("MSG") ?? "", fields.size);
  if (command === "LOAD_QUERY") {
    const hasFilter = ["ORIG_STATE", "DEST_STATE", "ORIG_CITY", "DEST_CITY", "ORIG_ZIP", "DEST_ZIP", "EQTYPE"].some((field) => fields.has(field));
    return hasFilter ? loadQueryResponse(fields) : loadErrorFrame("MISSING_FIELD", "A load filter is required");
  }
  if (command === "LOAD_GET") {
    if (!fields.has("LOAD_ID")) return loadErrorFrame("MISSING_FIELD", "LOAD_ID is required");
    const load = LOAD_DATASET.find((candidate) => candidate.loadId === fields.get("LOAD_ID"));
    return load ? Buffer.concat([loadFrame(load, false), Buffer.from("END\r\n")]) : loadErrorFrame("UNKNOWN_LOAD", "Load was not found");
  }
  if (command === "LOAD_BOOK") {
    if (bookingServerError) return loadErrorFrame("SERVER_ERROR", "Booking service unavailable");
    if (!fields.has("LOAD_ID") || !fields.has("MC_NUM") || !fields.has("AGREED_RATE")) {
      return loadErrorFrame("MISSING_FIELD", "Booking fields are required");
    }

    const agreedRate = Number(fields.get("AGREED_RATE"));
    if (!Number.isFinite(agreedRate) || agreedRate <= 0) return loadErrorFrame("INVALID_RATE", "Agreed rate is invalid");
    try {
      return bookingFrame(bookLoadInState(bookingState, {
        loadId: fields.get("LOAD_ID") ?? "",
        mcNumber: fields.get("MC_NUM") ?? "",
        agreedRate,
      }));
    } catch (error) {
      return error instanceof BookingStateError
        ? loadErrorFrame(error.code, error.message)
        : loadErrorFrame("SERVER_ERROR", "Booking service unavailable");
    }
  }
  return errorFrame("UNKNOWN_CMD", "Unknown command");
}

function parseRequest(line: string): Map<string, string> | Error {
  const fields = new Map<string, string>();
  if (!line || line.includes("\r") || line.includes("\n")) return new Error("malformed");
  for (const segment of line.split("|")) {
    const separator = segment.indexOf(":");
    if (separator <= 0) return new Error("malformed");
    const name = segment.slice(0, separator);
    const value = segment.slice(separator + 1);
    if (!IDENTIFIER.test(name) || fields.has(name) || !value || value.includes("\r") || value.includes("\n")) return new Error("malformed");
    fields.set(name, value);
  }
  if (fields.get("CMD") === undefined || fields.get("AUTH") === undefined) return new Error("malformed");
  const entries = [...fields.keys()];
  if (entries[0] !== "CMD" || entries[1] !== "AUTH") return new Error("malformed");
  if (entries.slice(2).some((name) => name === "CMD" || name === "AUTH")) return new Error("malformed");
  return fields;
}

function decodeRequest(bytes: Buffer): string | Error {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new Error("malformed");
  }
}

export function createMockLtmsServer(options: MockLtmsOptions = {}): MockLtmsServer {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 9000;
  const authToken = options.authToken ?? "local-test-token";
  const bookingState = createLoadBookingState();
  let connectionCount = 0;
  let requestCount = 0;
  let dispatchCount = 0;
  let server: net.Server | undefined;
  const sockets = new Set<net.Socket>();
  const timers = new Set<MockTimer>();
  const fault = resolveMockFault(options);

  const schedule = (callback: () => void, delayMs: number): void => {
    const timer = setTimeout(() => {
      timers.delete(timer);
      callback();
    }, delayMs);
    timers.add(timer);
  };

  const handle = (socket: net.Socket) => {
    connectionCount += 1;
    sockets.add(socket);
    let buffer = Buffer.alloc(0);
    let handled = false;
    socket.on("data", (chunk) => {
      if (handled) return;
      buffer = Buffer.concat([buffer, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)]);
      if (buffer.byteLength > DEFAULT_TMS_FRAME_BYTES) {
        handled = true;
        socket.end(errorFrame("MALFORMED", "Request exceeds the configured frame limit"));
        return;
      }
      const cr = buffer.indexOf(13);
      const lf = buffer.indexOf(10);
      const firstControl = cr === -1 ? lf : lf === -1 ? cr : Math.min(cr, lf);
      if (firstControl === -1) return;
      if (buffer[firstControl] === 10 || firstControl + 1 >= buffer.length) {
        if (buffer[firstControl] === 10) {
          handled = true;
          socket.end(errorFrame("MALFORMED", "Malformed request"));
        }
        return;
      }
      if (buffer[firstControl + 1] !== 10) {
        handled = true;
        socket.end(errorFrame("MALFORMED", "Malformed request"));
        return;
      }
      const end = firstControl;
      handled = true;
      requestCount += 1;
      const line = decodeRequest(buffer.subarray(0, end));
      const trailing = buffer.subarray(end + 2);
      const fields = line instanceof Error ? line : parseRequest(line);
      if (trailing.length || fields instanceof Error) {
        socket.end(errorFrame("MALFORMED", "Malformed request"));
        return;
      }
      if (fields.get("AUTH") !== authToken) {
        socket.end(errorFrame("AUTH_FAILED", "Authentication failed"));
        return;
      }
      if (applyPreDispatchFault(socket, fault)) return;

      dispatchCount += 1;
      const response = dispatchCommand(fields, bookingState, options.bookingServerError ?? false);
      if (!writePostDispatchResponse(socket, response, fault, schedule)) socket.end(response);
    });
    socket.on("close", () => sockets.delete(socket));
  };

  return {
    get connectionCount() { return connectionCount; },
    get requestCount() { return requestCount; },
    get dispatchCount() { return dispatchCount; },
    start: () => new Promise((resolve, reject) => {
      server = net.createServer(handle);
      server.once("error", reject);
      server.listen(port, host, () => {
        const address = server?.address();
        if (!address || typeof address === "string") return reject(new Error("Mock server did not expose an address."));
        resolve({ host, port: address.port });
      });
    }),
    stop: () => new Promise((resolve, reject) => {
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      for (const socket of sockets) socket.destroy();
      if (!server) return resolve();
      server.close((error) => error ? reject(error) : resolve());
      server = undefined;
    }),
  };
}
