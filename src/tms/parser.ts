import { TmsProtocolError, TmsRemoteError, TmsResponseIncompleteError } from "./errors";
import type { TmsFields, TmsParsedResponse, TmsRecord } from "./types";

const IDENTIFIER = /^[A-Z][A-Z0-9_]*$/;
const CR = 13;
const LF = 10;

function trimAsciiPadding(value: string): string {
  return value.replace(/^[ \t]+|[ \t]+$/g, "");
}

function decode(bytes: Buffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new TmsProtocolError("Response contains invalid UTF-8.");
  }
}

function parseFields(line: string): TmsFields {
  const fields: TmsFields = {};
  for (const segment of line.split("|")) {
    const separator = segment.indexOf(":");
    if (separator <= 0) throw new TmsProtocolError("Response contains a malformed field.");
    const name = trimAsciiPadding(segment.slice(0, separator));
    const value = trimAsciiPadding(segment.slice(separator + 1));
    if (!IDENTIFIER.test(name)) throw new TmsProtocolError("Response contains an invalid field name.");
    if (name === "CMD" || name === "AUTH") throw new TmsProtocolError("Response contains a reserved field.");
    if (name in fields) throw new TmsProtocolError("Response contains a duplicate field.");
    fields[name] = value;
  }
  return fields;
}

export class LtmsResponseParser {
  private pending = Buffer.alloc(0);
  private records: TmsRecord[] = [];
  private totalBytes = 0;
  private result: TmsParsedResponse | undefined;

  constructor(private readonly maxFrameBytes = 4096) {
    if (!Number.isInteger(maxFrameBytes) || maxFrameBytes <= 0) throw new TmsProtocolError("Invalid response frame limit.");
  }

  push(chunk: Buffer | string): TmsParsedResponse | undefined {
    if (this.result) throw new TmsProtocolError("Response data arrived after the terminal frame.");
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    this.totalBytes += bytes.byteLength;
    if (this.totalBytes > this.maxFrameBytes) throw new TmsProtocolError("TMS response exceeds the configured frame limit.");
    this.pending = Buffer.concat([this.pending, bytes]);

    while (true) {
      const lineEnd = this.pending.indexOf(Buffer.from([CR, LF]));
      if (lineEnd === -1) return undefined;
      const lineBytes = this.pending.subarray(0, lineEnd);
      this.pending = this.pending.subarray(lineEnd + 2);
      const line = decode(lineBytes);

      if (line === "END") {
        if (this.pending.byteLength > 0) throw new TmsProtocolError("Trailing bytes after END.");
        this.result = { records: this.records, rawBytes: this.totalBytes };
        return this.result;
      }

      if (line.startsWith("ERR|")) {
        const fields = parseFields(line.slice(4));
        if (!fields.CODE) throw new TmsProtocolError("Remote error is missing CODE.");
        throw new TmsRemoteError(fields.CODE, fields.MSG ?? "");
      }

      if (!line) throw new TmsProtocolError("Empty response record.");
      this.records.push({ fields: parseFields(line), rawLine: line });
    }
  }

  finish(): TmsParsedResponse {
    if (this.result) return this.result;
    throw new TmsResponseIncompleteError();
  }
}

export function parseResponse(data: Buffer | string, maxFrameBytes = 4096): TmsParsedResponse {
  const parser = new LtmsResponseParser(maxFrameBytes);
  parser.push(data);
  return parser.finish();
}
