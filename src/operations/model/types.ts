export type UiState = "SUCCESS_STATE" | "FAILED_STATE" | "NOT_ATTEMPTED_STATE" | "UNAVAILABLE_STATE" | "DISABLED_STATE" | "UNKNOWN_STATE";
export type Row = { callId: string; occurredAt: string; source: "fixture" | "ingested"; mcMasked?: string; fmcsaStatus: string; otpStatus: string; loadId?: string; agreedRate?: number; bookingReference?: string; bookingStatus: string; bookingSuccessful: boolean; outcome: string; handoffStatus: string; technicalStatus: string; mode: "demo" | "real-read-only" };
export type Summary = { totalCalls: number; fmcsaverified: number; loadsMatched: number; demoBookings: number; failedNegotiations: number; handoffs: number; technicalErrors: number; fmcsaVerificationRate: number | null };
export type HealthItem = { label: string; state: string; detail: string };
export type DashboardData = { calls: Row[]; summary: Summary; health: HealthItem[] };
