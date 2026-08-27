import { TmsRemoteError, TmsUpstreamError } from "./errors";
import { recordToBookingPublic, toBookLoadFields } from "./booking";
import { recordToPublicLoad, toLoadDetailFields, toLoadQueryFields } from "./loads";
import type { BookLoadInput, BookingPublic, LoadDetailInput, LoadPublic, LoadQueryInput, TmsCommandRequest, TmsParsedResponse } from "./types";

export interface LoadTmsPort {
  execute(request: TmsCommandRequest): Promise<TmsParsedResponse>;
}

function requireSingleRecord(response: TmsParsedResponse, operation: string) {
  if (response.records.length !== 1) {
    throw new TmsUpstreamError(`${operation} response must contain exactly one record.`);
  }
  return response.records[0]!;
}

export async function searchLoads(input: LoadQueryInput, port: LoadTmsPort): Promise<LoadPublic[]> {
  const response = await port.execute({ command: "LOAD_QUERY", fields: toLoadQueryFields(input) });
  return response.records.map(recordToPublicLoad);
}

export async function getLoad(input: LoadDetailInput, port: LoadTmsPort): Promise<LoadPublic> {
  const response = await port.execute({ command: "LOAD_GET", fields: toLoadDetailFields(input) });
  if (!response.records.length) throw new TmsRemoteError("UNKNOWN_LOAD", "Load was not found.");
  const record = requireSingleRecord(response, "LOAD_GET");
  return recordToPublicLoad(record);
}

export async function bookLoad(input: BookLoadInput, port: LoadTmsPort): Promise<BookingPublic> {
  const response = await port.execute({ command: "LOAD_BOOK", fields: toBookLoadFields(input) });
  if (!response.records.length) throw new TmsRemoteError("SERVER_ERROR", "Booking response was empty.", false);
  const record = requireSingleRecord(response, "LOAD_BOOK");
  return recordToBookingPublic(record);
}
