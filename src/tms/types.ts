import type { ValidatedRealTarget } from "./target-authority";

export type TmsFields = Record<string, string>;

export const TMS_MODES = {
  MOCK: "mock",
  REAL: "real",
} as const;

export type TmsMode = (typeof TMS_MODES)[keyof typeof TMS_MODES];

export interface TmsRequest {
  command: string;
  authToken: string;
  fields?: Record<string, string | number>;
}

export interface TmsCommandRequest {
  command: string;
  fields?: Record<string, string | number>;
  requestId?: string;
}

export interface TmsRecord {
  fields: TmsFields;
  /** Optional bare response marker, such as the real TMS `ECHO` marker. */
  recordType?: string;
}

export interface TmsParsedResponse {
  records: TmsRecord[];
  rawBytes: number;
}

export interface TmsResponseLimits {
  maxBytes: number;
  maxLineBytes: number;
  maxRecords: number;
}

/** Internal parser record; raw wire text must not cross service/HTTP boundaries. */
export interface TmsInternalRecord extends TmsRecord {
  rawLine: string;
}

export interface TmsInternalParsedResponse {
  records: TmsInternalRecord[];
  rawBytes: number;
}

export interface TmsConfig {
  mode: TmsMode;
  host: string;
  port: number;
  authToken: string;
  connectTimeoutMs: number;
  responseTimeoutMs: number;
  /** @deprecated Use maxRequestBytes. Retained for local fixture compatibility. */
  maxFrameBytes: number;
  maxRequestBytes?: number;
  responseLimits?: TmsResponseLimits;
  /** Required for real mode; omitted for synthetic/mock configs. */
  targetPin?: string;
  /** Independent approved real target set; required for real booking. */
  approvedTargets?: readonly string[];
  /** Plain TCP is accepted only with an explicit private-network approval. */
  transportApproval?: "private-network";
  validatedTarget?: ValidatedRealTarget;
}

export interface EchoResult {
  message: string;
  fieldCount: number;
}

export interface LoadQueryInput {
  originState?: string;
  destinationState?: string;
  originCity?: string;
  destinationCity?: string;
  originZip?: string;
  destinationZip?: string;
  equipmentType?: string;
  maxResults?: number;
}

export interface LoadDetailInput {
  loadId: string;
}

export interface LoadInternal {
  loadId: string;
  originState: string;
  destinationState: string;
  originCity: string;
  destinationCity: string;
  equipmentType: string;
  rate: number;
  notes: string;
  pickupDate?: string;
  miles?: number;
  status?: string;
  /** Internal policy data; it must never cross the public HTTP boundary. */
  maxBuy?: number;
}

export interface LoadPublic {
  loadId: string;
  originState: string;
  destinationState: string;
  originCity: string;
  destinationCity: string;
  equipmentType: string;
  rate: number;
  notes: string;
  pickupDate?: string;
  miles?: number;
  status?: string;
}

export interface BookLoadInput {
  loadId: string;
  mcNumber: string;
  agreedRate: number;
}

export interface BookingInternal {
  loadId: string;
  mcNumber: string;
  agreedRate: number;
  bookingRef: string;
  bookedAt: string;
}

export type BookingPublic = BookingInternal;
