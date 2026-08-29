export const MAX_NOTE_LENGTH = 240;
export const MAX_STORED_CALLS = 10_000;
export const MAX_LIST_RESULTS = 500;
export const MAX_TIMELINE_STEPS = 8;
export const MAX_MATCHED_LOADS = 20;
export const MAX_LOAD_ID_LENGTH = 64;
export const MAX_RATE = 1_000_000;
export const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;

export type SafeIdentifier = string & { readonly __brand: "OperationsSafeIdentifier" };
export type IsoDateTime = string & { readonly __brand: "OperationsIsoDateTime" };
export type SafeDisplayText = string & { readonly __brand: "OperationsDisplayText" };
export type SanitizedNote = string & { readonly __brand: "OperationsSanitizedNote" };
export type MaskedMc = `MC•••${string}`;
export type OperationsMode = "demo" | "real-read-only";
export type CallRecordSource = "fixture" | "ingested";
export type CallOutcome = "SUCCESS" | "OTP_DELIVERY_UNAVAILABLE" | "NO_MATCHING_LOAD" | "FAILED_NEGOTIATION" | "ALREADY_BOOKED" | "BOOKING_NOT_ATTEMPTED" | "HUMAN_HANDOFF" | "TECHNICAL_ERROR";
export type FmcsaStatus = "VERIFIED" | "UNAVAILABLE" | "FAILED" | "NOT_RUN";
export type OtpStatus = FmcsaStatus;
export type BookingStatus = "NOT_REQUESTED" | "BOOKED" | "ALREADY_BOOKED" | "FAILED";
export type HandoffStatus = "NOT_REQUESTED" | "REQUESTED" | "COMPLETED" | "FAILED";
export type TechnicalStatus = "SUCCESS" | "ERROR" | "TIMEOUT" | "UNAVAILABLE";
export type TimelineStepName = "CALL_RECEIVED" | "FMCSA_VALIDATION" | "OTP_IDENTITY_CONFIRMATION" | "LOAD_SEARCH" | "LOAD_DETAIL" | "NEGOTIATION" | "BOOKING" | "HUMAN_HANDOFF";
export type TimelineStepStatus = "COMPLETED" | "SKIPPED" | "FAILED";

export interface TimelineStep { readonly name: TimelineStepName; readonly status: TimelineStepStatus; readonly occurredAt: IsoDateTime; readonly order: number; readonly durationMs?: number; readonly errorCode?: SafeIdentifier; readonly requestId?: SafeIdentifier; }
export interface LoadSummary { readonly loadId: SafeIdentifier; readonly origin?: SafeDisplayText; readonly destination?: SafeDisplayText; readonly equipment?: SafeDisplayText; readonly publishedRate?: number; }
export interface CallRecord {
  readonly callId: SafeIdentifier; readonly occurredAt: IsoDateTime; readonly source: CallRecordSource; readonly mode: OperationsMode; readonly outcome: CallOutcome;
  readonly fmcsaStatus: FmcsaStatus; readonly otpStatus: OtpStatus; readonly bookingStatus: BookingStatus; readonly bookingSuccessful: boolean; readonly bookingReference?: SafeIdentifier;
  readonly handoffStatus: HandoffStatus; readonly handoffReason?: SafeDisplayText; readonly technicalStatus: TechnicalStatus; readonly timeline: readonly TimelineStep[];
  readonly matchedLoads: readonly LoadSummary[]; readonly mcMasked?: MaskedMc; readonly notes?: SanitizedNote; readonly agreedRate?: number;
}
export interface RawOperationsCallPayload { readonly callId?: string; readonly occurredAt: string; readonly mcNumber: string; readonly loadId?: string | null; readonly agreedRate?: number | null; readonly fmcsaverified: boolean; readonly otpVerified: boolean; readonly bookingSuccessful: boolean; readonly bookingRef: string | null; readonly outcome: CallOutcome; readonly handoffReason: string | null; readonly notes: string; readonly mode: OperationsMode; readonly technicalStatus: TechnicalStatus; readonly origin?: string; readonly destination?: string; readonly equipment?: string; readonly publishedRate?: number; }
export interface CallFilters { readonly fromOccurredAt?: IsoDateTime; readonly toOccurredAt?: IsoDateTime; readonly callId?: SafeIdentifier; readonly loadId?: SafeIdentifier; readonly source?: CallRecordSource; readonly mode?: OperationsMode; readonly outcome?: CallOutcome; readonly fmcsaStatus?: FmcsaStatus; readonly otpStatus?: OtpStatus; readonly bookingStatus?: BookingStatus; readonly handoffStatus?: HandoffStatus; readonly technicalStatus?: TechnicalStatus; }
export interface CallSummary { readonly totalCalls: number; readonly fmcsaverified: number; readonly fmcsaDenominator: number; readonly fmcsaVerificationRate: number | null; readonly loadsMatched: number; readonly demoBookings: number; readonly failedNegotiations: number; readonly handoffs: number; readonly technicalErrors: number; }
export interface CallEventStore { list(filters: CallFilters): Promise<CallRecord[]>; get(callId: SafeIdentifier): Promise<CallRecord | null>; insert(record: CallRecord): Promise<CallRecord>; summary(filters: CallFilters): Promise<CallSummary>; }
