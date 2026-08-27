import { TmsUpstreamError } from "./errors";
import type { EchoResult, TmsParsedResponse } from "./types";

export function responseToEchoResult(response: TmsParsedResponse): EchoResult {
  if (response.records.length !== 1) {
    throw new TmsUpstreamError("DEBUG_ECHO response must contain exactly one record.");
  }

  const fields = response.records[0]!.fields;
  const message = fields.MSG;
  const rawFieldCount = fields.FIELD_COUNT;
  const fieldCount = rawFieldCount === undefined ? Number.NaN : Number(rawFieldCount);

  if (
    message === undefined ||
    rawFieldCount === undefined ||
    !Number.isInteger(fieldCount) ||
    fieldCount < 0 ||
    Object.keys(fields).some((field) => field !== "MSG" && field !== "FIELD_COUNT")
  ) {
    throw new TmsUpstreamError("DEBUG_ECHO response has an invalid shape.");
  }

  return { message, fieldCount };
}
