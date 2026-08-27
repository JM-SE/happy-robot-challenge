import { TmsUpstreamError } from "./errors";
import type { EchoResult, TmsParsedResponse } from "./types";

export function responseToEchoResult(response: TmsParsedResponse): EchoResult {
  if (response.records.length !== 1) {
    throw new TmsUpstreamError("DEBUG_ECHO response must contain exactly one record.");
  }

  const fields = response.records[0]!.fields;
  const message = fields.MSG;
  const isRealShape = response.records[0]!.recordType === "ECHO";
  const rawFieldCount = isRealShape ? fields.FIELDS_PARSED : fields.FIELD_COUNT;
  const fieldCount = rawFieldCount === undefined ? Number.NaN : Number(rawFieldCount);
  const expectedFields = isRealShape ? ["AUTH", "FIELDS_PARSED", "MSG"] : ["FIELD_COUNT", "MSG"];

  if (
    (isRealShape && fields.AUTH !== "OK") ||
    (!isRealShape && response.records[0]!.recordType !== undefined) ||
    message === undefined ||
    rawFieldCount === undefined ||
    !Number.isInteger(fieldCount) ||
    fieldCount < 0 ||
    Object.keys(fields).some((field) => !expectedFields.includes(field)) ||
    Object.keys(fields).length !== expectedFields.length
  ) {
    throw new TmsUpstreamError("DEBUG_ECHO response has an invalid shape.");
  }

  return { message, fieldCount };
}
