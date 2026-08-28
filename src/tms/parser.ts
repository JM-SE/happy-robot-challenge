import { TmsProtocolError, TmsRemoteError, TmsResponseIncompleteError } from "./errors";
import { DEFAULT_TMS_FRAME_BYTES, MAX_TMS_RAW_LINE_BYTES, MAX_TMS_RESPONSE_RECORDS } from "./limits";
import type { TmsFields, TmsInternalParsedResponse, TmsInternalRecord, TmsParsedResponse } from "./types";

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

export function redactDiagnosticLine(line: string): string {
  const redacted = line.split("|").map((segment) => {
    const separator = segment.indexOf(":");
    if (separator <= 0) return segment;
    const name = trimAsciiPadding(segment.slice(0, separator));
    return /(AUTH|TOKEN|SECRET|PASSWORD|API_KEY|MAX_BUY|NOTES)/.test(name)
      ? `${name}:[REDACTED]`
      : segment;
  }).join("|");

  if (Buffer.byteLength(redacted, "utf8") <= MAX_TMS_RAW_LINE_BYTES) return redacted;
  let bounded = Buffer.from(redacted, "utf8").subarray(0, MAX_TMS_RAW_LINE_BYTES).toString("utf8");
  while (Buffer.byteLength(bounded, "utf8") > MAX_TMS_RAW_LINE_BYTES) bounded = bounded.slice(0, -1);
  return bounded;
}

function parseFields(line: string, allowResponseAuth = false): TmsFields {
  const fields: TmsFields = {};
  for (const segment of line.split("|")) {
    const separator = segment.indexOf(":");
    if (separator <= 0) throw new TmsProtocolError("Response contains a malformed field.");
    const name = trimAsciiPadding(segment.slice(0, separator));
    const value = trimAsciiPadding(segment.slice(separator + 1));
    if (!IDENTIFIER.test(name)) throw new TmsProtocolError("Response contains an invalid field name.");
    // NOTES is a valid optional payload in the load record contract; all other
    // response fields must carry a value.
    if (!value && name !== "NOTES") throw new TmsProtocolError("Response contains an empty field value.");
    if (name === "CMD" || (name === "AUTH" && !allowResponseAuth)) throw new TmsProtocolError("Response contains a reserved field.");
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
  const fields = parseFields(segments.join("|"), recordType === "ECHO");
  return recordType
     ? { fields, recordType, rawLine: redactDiagnosticLine(line) }
     : { fields, rawLine: redactDiagnosticLine(line) };
}

export class LtmsResponseParser {
  private pending = Buffer.alloc(0);
  private records: TmsInternalRecord[] = [];
  private totalBytes = 0;
  private result: TmsInternalParsedResponse | undefined;

  constructor(private readonly maxFrameBytes = DEFAULT_TMS_FRAME_BYTES) {
    if (!Number.isInteger(maxFrameBytes) || maxFrameBytes <= 0) throw new TmsProtocolError("Invalid response frame limit.");
  }

  push(chunk: Buffer | string): TmsParsedResponse | undefined {
    if (this.result) throw new TmsProtocolError("Response data arrived after the terminal frame.");
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    this.totalBytes += bytes.byteLength;
    if (this.totalBytes > this.maxFrameBytes) throw new TmsProtocolError("TMS response exceeds the configured frame limit.");
    this.pending = Buffer.concat([this.pending, bytes]);

    while (true) {
      const lineEnd = this.findStrictLineEnd();
      if (lineEnd === undefined) return undefined;
      const lineBytes = this.pending.subarray(0, lineEnd);
      if (lineBytes.byteLength > MAX_TMS_RAW_LINE_BYTES) throw new TmsProtocolError("Response line exceeds the configured limit.");
      this.pending = this.pending.subarray(lineEnd + 2);
      const line = decode(lineBytes);

      if (line === "END") {
        if (this.pending.byteLength > 0) throw new TmsProtocolError("Trailing bytes after END.");
        this.result = { records: this.records, rawBytes: this.totalBytes };
        return toPublicResponse(this.result);
      }

      if (line.startsWith("ERR|")) {
        const fields = parseFields(line.slice(4));
        if (!fields.CODE) throw new TmsProtocolError("Remote error is missing CODE.");
        if (fields.MSG === undefined) throw new TmsProtocolError("Remote error is missing MSG.");
        throw new TmsRemoteError(fields.CODE, fields.MSG);
      }

      if (!line) throw new TmsProtocolError("Empty response record.");
       if (this.records.length >= MAX_TMS_RESPONSE_RECORDS) throw new TmsProtocolError("TMS response contains too many records.");
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

export function parseResponse(data: Buffer | string, maxFrameBytes = DEFAULT_TMS_FRAME_BYTES): TmsParsedResponse {
  const parser = new LtmsResponseParser(maxFrameBytes);
  parser.push(data);
  return parser.finish();
}
