export type TmsFields = Record<string, string>;

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
  /** Retained only for bounded internal diagnostics; never returned by HTTP. */
  rawLine: string;
}

export interface TmsParsedResponse {
  records: TmsRecord[];
  rawBytes: number;
}

export interface TmsConfig {
  host: string;
  port: number;
  authToken: string;
  connectTimeoutMs: number;
  responseTimeoutMs: number;
  maxFrameBytes: number;
}

export interface EchoResult {
  message: string;
  fieldCount: number | null;
}

export interface LoadQueryInput {
  originState?: string;
  destinationState?: string;
  originCity?: string;
  destinationCity?: string;
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
  /** Internal policy data; it must never cross the public HTTP boundary. */
  maxBuy: number;
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
