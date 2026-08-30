import { setTmsMappingRecordIndex, TmsRemoteError, TmsUpstreamError } from "./errors";
import { recordToPublicLoad, toLoadDetailFields, toLoadQueryFields } from "./loads";
import type { LoadDetailInput, LoadPublic, LoadQueryInput, TmsCommandRequest, TmsParsedResponse } from "./types";

export interface LoadTmsPort {
  execute(request: TmsCommandRequest): Promise<TmsParsedResponse>;
}

function requireSingleRecord(response: TmsParsedResponse, operation: string) {
  if (response.records.length !== 1) {
    throw new TmsUpstreamError(`${operation} response must contain exactly one record.`);
  }
  return response.records[0]!;
}

export async function searchLoads(input: LoadQueryInput, port: LoadTmsPort, requestId?: string): Promise<LoadPublic[]> {
  const response = await port.execute({ command: "LOAD_QUERY", fields: toLoadQueryFields(input), ...(requestId === undefined ? {} : { requestId }) });
  return response.records.map((record, recordIndex) => {
    try {
      return recordToPublicLoad(record);
    } catch (error) {
      setTmsMappingRecordIndex(error, recordIndex);
      throw error;
    }
  });
}

export async function getLoad(input: LoadDetailInput, port: LoadTmsPort, requestId?: string): Promise<LoadPublic> {
  const response = await port.execute({ command: "LOAD_GET", fields: toLoadDetailFields(input), ...(requestId === undefined ? {} : { requestId }) });
  if (!response.records.length) throw new TmsRemoteError("UNKNOWN_LOAD", "Load was not found.");
  const record = requireSingleRecord(response, "LOAD_GET");
  try {
    return recordToPublicLoad(record);
  } catch (error) {
    setTmsMappingRecordIndex(error, 0);
    throw error;
  }
}
