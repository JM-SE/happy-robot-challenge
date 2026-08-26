import { TmsRemoteError } from "./errors";
import { recordToLoadInternal, toLoadDetailFields, toLoadQueryFields, toPublicLoad } from "./loads";
import type { LoadDetailInput, LoadPublic, LoadQueryInput, TmsCommandRequest, TmsParsedResponse } from "./types";

export interface LoadTmsPort {
  execute(request: TmsCommandRequest): Promise<TmsParsedResponse>;
}

export async function searchLoads(input: LoadQueryInput, port: LoadTmsPort): Promise<LoadPublic[]> {
  const response = await port.execute({ command: "LOAD_QUERY", fields: toLoadQueryFields(input) });
  return response.records.map(recordToLoadInternal).map(toPublicLoad);
}

export async function getLoad(input: LoadDetailInput, port: LoadTmsPort): Promise<LoadPublic> {
  const response = await port.execute({ command: "LOAD_GET", fields: toLoadDetailFields(input) });
  const record = response.records[0];
  if (!record) throw new TmsRemoteError("UNKNOWN_LOAD", "Load was not found.");
  return toPublicLoad(recordToLoadInternal(record));
}
