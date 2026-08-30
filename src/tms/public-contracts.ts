import type { TmsMode } from "./types";

export const DEFAULT_MAX_RESULTS = 10;
export const MAX_PUBLIC_RATE = 1_000_000;
export const MAX_PUBLIC_MILES = 10_000;
export const MAX_PUBLIC_DATE_LENGTH = 10;
export const MAX_PUBLIC_MC_LENGTH = 64;

export const MAX_TMS_STATUS_LENGTH = 64;

const PUBLIC_LOAD_STATUSES = {
  AVAILABLE: "AVAILABLE",
  OPEN: "OPEN",
  BOOKED: "BOOKED",
} as const;

export type PublicLoadStatus = string;

export interface PublicSearchRequest {
  originState?: string;
  destinationState?: string;
  equipmentType?: string;
  maxResults: number;
}

export interface PublicDetailRequest {
  loadId: string;
}

export interface PublicBookingRequest {
  loadId: string;
  mc: string;
  agreedRate: number;
}

export interface PublicLoadSummary {
  loadId: string;
  originState: string;
  destinationState: string;
  originCity: string;
  destinationCity: string;
  equipmentType: string;
  rate: number;
  pickupDate?: string;
  miles?: number;
  status?: PublicLoadStatus;
}

export interface PublicLoadDetail {
  loadId: string;
  originState: string;
  destinationState: string;
  originCity: string;
  destinationCity: string;
  equipmentType: string;
  rate: number;
  pickupDate?: string;
  miles?: number;
  status?: PublicLoadStatus;
}

export interface PublicBookingResult {
  bookingRef: string;
  loadId: string;
  agreedRate: number;
  bookedAt: string;
  mode: Extract<TmsMode, "mock">;
  demo: true;
}

export { PUBLIC_LOAD_STATUSES };
