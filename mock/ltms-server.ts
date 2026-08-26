import net from "node:net";
import { LOAD_DATASET } from "./dataset";
import type { LoadInternal } from "../src/tms/types";

export interface MockLtmsOptions {
  host?: string;
  port?: number;
  authToken?: string;
}

export interface MockLtmsServer {
  readonly connectionCount: number;
  readonly requestCount: number;
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
    if (fields.has("EQTYPE") && !matchesValue("equipmentType", fields.get("EQTYPE") ?? "", true)) return false;
    return true;
  });
  const maxResults = Number(fields.get("MAX_RESULTS") ?? matches.length);
  const selected = matches.slice(0, Number.isInteger(maxResults) && maxResults > 0 ? maxResults : matches.length);
  return Buffer.concat([...selected.map((load, index) => loadFrame(load, index % 2 === 1)), Buffer.from("END\r\n")]);
}

function parseRequest(line: string): Map<string, string> | Error {
  const fields = new Map<string, string>();
  for (const segment of line.split("|")) {
    const separator = segment.indexOf(":");
    if (separator <= 0) return new Error("malformed");
    const name = segment.slice(0, separator);
    const value = segment.slice(separator + 1);
    if (fields.has(name) || !value || value.includes("\r") || value.includes("\n")) return new Error("malformed");
    fields.set(name, value);
  }
  return fields;
}

export function createMockLtmsServer(options: MockLtmsOptions = {}): MockLtmsServer {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 9000;
  const authToken = options.authToken ?? "local-test-token";
  let connectionCount = 0;
  let requestCount = 0;
  let server: net.Server | undefined;
  const sockets = new Set<net.Socket>();

  const handle = (socket: net.Socket) => {
    connectionCount += 1;
    sockets.add(socket);
    let buffer = Buffer.alloc(0);
    let handled = false;
    socket.on("data", (chunk) => {
      if (handled) return;
      buffer = Buffer.concat([buffer, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)]);
      const end = buffer.indexOf(Buffer.from("\r\n"));
      if (end < 0) return;
      handled = true;
      requestCount += 1;
      const line = buffer.subarray(0, end).toString("utf8");
      const trailing = buffer.subarray(end + 2);
      let response: Buffer;
      const fields = parseRequest(line);
      if (trailing.length || fields instanceof Error) response = errorFrame("MALFORMED", "Malformed request");
      else if (fields.get("AUTH") !== authToken) response = errorFrame("AUTH_FAILED", "Authentication failed");
      else if (fields.get("CMD") === "DEBUG_ECHO" && !fields.has("MSG")) response = errorFrame("MISSING_FIELD", "MSG is required");
      else if (fields.get("CMD") === "DEBUG_ECHO") response = responseFrame(fields.get("MSG") ?? "", fields.size);
      else if (fields.get("CMD") === "LOAD_QUERY") {
        const hasFilter = ["ORIG_STATE", "DEST_STATE", "ORIG_CITY", "DEST_CITY", "EQTYPE"].some((field) => fields.has(field));
        response = hasFilter ? loadQueryResponse(fields) : loadErrorFrame("MISSING_FIELD", "A load filter is required");
      } else if (fields.get("CMD") === "LOAD_GET") {
        const load = LOAD_DATASET.find((candidate) => candidate.loadId === fields.get("LOAD_ID"));
        response = load ? Buffer.concat([loadFrame(load, false), Buffer.from("END\r\n")]) : loadErrorFrame("UNKNOWN_LOAD", "Load was not found");
      } else response = errorFrame("UNKNOWN_CMD", "Unknown command");
      socket.end(response);
    });
    socket.on("close", () => sockets.delete(socket));
  };

  return {
    get connectionCount() { return connectionCount; },
    get requestCount() { return requestCount; },
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
      for (const socket of sockets) socket.destroy();
      if (!server) return resolve();
      server.close((error) => error ? reject(error) : resolve());
      server = undefined;
    }),
  };
}
