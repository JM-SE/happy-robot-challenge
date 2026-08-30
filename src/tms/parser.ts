import { TmsProtocolError, TmsRemoteError, TmsResponseIncompleteError } from "./errors";
import { DEFAULT_TMS_RESPONSE_BYTES, DEFAULT_TMS_RESPONSE_LINE_BYTES, DEFAULT_TMS_RESPONSE_RECORDS, MAX_TMS_DIAGNOSTIC_LINE_BYTES } from "./limits";
import type { TmsFields, TmsInternalParsedResponse, TmsInternalRecord, TmsParsedResponse, TmsResponseLimits } from "./types";

const IDENTIFIER = /^[A-Z][A-Z0-9_]*$/;
const CR = 13;
const LF = 10;

function trimAsciiPadding(value: string): string {
  return value.replace(/^[ \t]+|[ \t]+$/g, "");
}

function decode(bytes: Buffer): string {
  if (bytes.some((byte) => byte > 0x7f)) throw new TmsProtocolError("Response contains non-ASCII bytes.");
  try {
    return bytes.toString("ascii");
  } catch {
    throw new TmsProtocolError("Response contains invalid ASCII.");
  }
}

export function redactDiagnosticLine(line: string): string {
  const redacted = line.split("|").map((segment) => {
    const separator = segment.indexOf(":");
    if (separator <= 0) return segment;
    const name = trimAsciiPadding(segment.slice(0, separator));
    return /(AUTH|TOKEN|SECRET|PASSWORD|API_KEY|MAX_BUY|NOTES)/.test(name)
      ? `${name}:[REDACTED]`
      : segment;
  }).join("|");

  if (Buffer.byteLength(redacted, "ascii") <= MAX_TMS_DIAGNOSTIC_LINE_BYTES) return redacted;
  let bounded = Buffer.from(redacted, "ascii").subarray(0, MAX_TMS_DIAGNOSTIC_LINE_BYTES).toString("ascii");
  while (Buffer.byteLength(bounded, "ascii") > MAX_TMS_DIAGNOSTIC_LINE_BYTES) bounded = bounded.slice(0, -1);
  return bounded;
}

function parseFields(line: string): TmsFields {
  const fields: TmsFields = {};
  for (const segment of line.split("|")) {
    const separator = segment.indexOf(":");
    if (separator <= 0) throw new TmsProtocolError("Response contains a malformed field.");
    const name = trimAsciiPadding(segment.slice(0, separator));
    const value = trimAsciiPadding(segment.slice(separator + 1));
    if (!IDENTIFIER.test(name)) throw new TmsProtocolError("Response contains an invalid field name.");
    if (name in fields) throw new TmsProtocolError("Response contains a duplicate field.");
    fields[name] = value;
  }
  return fields;
}

function parseRecord(line: string): TmsInternalRecord {
  const segments = line.split("|");
  const hasBareMarker = !segments[0]?.includes(":");
  if (hasBareMarker && segments[0] !== "ECHO") throw new TmsProtocolError("Response contains an unknown record marker.");

  const recordType = hasBareMarker ? segments.shift() : undefined;
  const fields = parseFields(segments.join("|"));
  return recordType
     ? { fields, recordType, rawLine: redactDiagnosticLine(line) }
     : { fields, rawLine: redactDiagnosticLine(line) };
}

export class LtmsResponseParser {
  private pending = Buffer.alloc(0);
  private records: TmsInternalRecord[] = [];
  private totalBytes = 0;
  private result: TmsInternalParsedResponse | undefined;

  private readonly limits: TmsResponseLimits;

  constructor(limits: TmsResponseLimits | number = {
    maxBytes: DEFAULT_TMS_RESPONSE_BYTES,
    maxLineBytes: DEFAULT_TMS_RESPONSE_LINE_BYTES,
    maxRecords: DEFAULT_TMS_RESPONSE_RECORDS,
  }) {
    this.limits = typeof limits === "number" ? { maxBytes: limits, maxLineBytes: DEFAULT_TMS_RESPONSE_LINE_BYTES, maxRecords: DEFAULT_TMS_RESPONSE_RECORDS } : limits;
    if (![this.limits.maxBytes, this.limits.maxLineBytes, this.limits.maxRecords].every((value) => Number.isInteger(value) && value > 0)) throw new TmsProtocolError("Invalid response limits.");
  }

  push(chunk: Buffer | string): TmsParsedResponse | undefined {
    if (this.result) throw new TmsProtocolError("Response data arrived after the terminal frame.");
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    this.totalBytes += bytes.byteLength;
    if (bytes.some((byte) => byte > 0x7f)) throw new TmsProtocolError("Response contains non-ASCII bytes.");
      if (this.totalBytes > this.limits.maxBytes) throw new TmsProtocolError("TMS response exceeds the configured limit.");
      this.pending = Buffer.concat([this.pending, bytes]);
      if (this.pending.byteLength > this.limits.maxLineBytes + 2 && !this.pending.includes(CR)) {
        throw new TmsProtocolError("Response line exceeds the configured limit.");
      }

    while (true) {
      const lineEnd = this.findStrictLineEnd();
      if (lineEnd === undefined) return undefined;
      const lineBytes = this.pending.subarray(0, lineEnd);
      if (lineBytes.byteLength > this.limits.maxLineBytes) throw new TmsProtocolError("Response line exceeds the configured limit.");
      this.pending = this.pending.subarray(lineEnd + 2);
      const line = decode(lineBytes);

      if (line === "END") {
        if (this.pending.byteLength > 0) throw new TmsProtocolError("Trailing bytes after END.");
        this.result = { records: this.records, rawBytes: this.totalBytes };
        return toPublicResponse(this.result);
      }

      if (line.startsWith("ERR|")) {
        const fields = parseFields(line.slice(4));
        if (!fields.CODE?.trim()) throw new TmsProtocolError("Remote error is missing CODE.");
        throw new TmsRemoteError(fields.CODE, fields.MSG ?? "");
      }

      if (!line) throw new TmsProtocolError("Empty response record.");
        if (this.records.length >= this.limits.maxRecords) throw new TmsProtocolError("TMS response contains too many records.");
       this.records.push(parseRecord(line));
    }
  }

  finish(): TmsParsedResponse {
    if (this.result) return toPublicResponse(this.result);
    if (this.pending.includes(CR) || this.pending.includes(LF)) {
      throw new TmsProtocolError("Response contains incomplete CRLF framing.");
    }
    throw new TmsResponseIncompleteError();
  }

  private findStrictLineEnd(): number | undefined {
    const cr = this.pending.indexOf(CR);
    const lf = this.pending.indexOf(LF);
    const firstControl = cr === -1 ? lf : lf === -1 ? cr : Math.min(cr, lf);
    if (firstControl === -1) return undefined;
    if (this.pending[firstControl] === LF) throw new TmsProtocolError("Response contains an isolated LF.");
    if (firstControl + 1 >= this.pending.length) return undefined;
    if (this.pending[firstControl + 1] !== LF) throw new TmsProtocolError("Response contains an invalid CRLF sequence.");
    return firstControl;
  }
}

function toPublicResponse(response: TmsInternalParsedResponse): TmsParsedResponse {
  return {
    records: response.records.map((record) => ({
      fields: record.fields,
      ...(record.recordType === undefined ? {} : { recordType: record.recordType }),
    })),
    rawBytes: response.rawBytes,
  };
}

export function parseResponse(data: Buffer | string, limits?: TmsResponseLimits | number): TmsParsedResponse {
  const parser = new LtmsResponseParser(limits);
  parser.push(data);
  return parser.finish();
}
