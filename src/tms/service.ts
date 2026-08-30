import { TmsUpstreamError } from "./errors";
import { toLoadDetailFields, toLoadQueryFields } from "./loads";
import { normalizeLoadRecordWithIndex } from "./load-normalizer";
import type { LoadDetailInput, LoadQueryInput, NormalizedLoad, TmsCommandRequest, TmsParsedResponse } from "./types";

export interface LoadTmsPort {
  execute(request: TmsCommandRequest): Promise<TmsParsedResponse>;
}

function requireSingleRecord(response: TmsParsedResponse, operation: string) {
  if (response.records.length !== 1) {
    throw new TmsUpstreamError(`${operation} response must contain exactly one record.`);
  }
  return response.records[0]!;
}

export async function searchLoads(input: LoadQueryInput, port: LoadTmsPort, requestId?: string): Promise<NormalizedLoad[]> {
  const response = await port.execute({ command: "LOAD_QUERY", fields: toLoadQueryFields(input), ...(requestId === undefined ? {} : { requestId }) });
  return response.records.map((record, recordIndex) => normalizeLoadRecordWithIndex(record, recordIndex));
}

export async function getLoad(input: LoadDetailInput, port: LoadTmsPort, requestId?: string): Promise<NormalizedLoad> {
  const response = await port.execute({ command: "LOAD_GET", fields: toLoadDetailFields(input), ...(requestId === undefined ? {} : { requestId }) });
  if (!response.records.length) throw new TmsUpstreamError("LOAD_GET response must contain exactly one record.");
  const record = requireSingleRecord(response, "LOAD_GET");
  return normalizeLoadRecordWithIndex(record, 0);
}
