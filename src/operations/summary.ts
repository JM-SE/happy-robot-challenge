import type { CallRecord, CallSummary } from "./contracts";

export function isBookingSuccess(record: CallRecord): boolean { return record.bookingSuccessful === true && !!record.bookingReference && record.bookingStatus === "BOOKED" && record.outcome === "SUCCESS" && record.mode === "demo"; }
export function summarizeCalls(records: readonly CallRecord[]): CallSummary {
  let verified = 0, denominator = 0, matched = 0, demoBookings = 0, failed = 0, handoffs = 0, technical = 0;
  for (const record of records) {
    if (record.fmcsaStatus === "VERIFIED") verified++;
    if (record.fmcsaStatus !== "NOT_RUN") denominator++;
    if (record.matchedLoads.length > 0) matched++;
    if (isBookingSuccess(record)) demoBookings++;
    if (record.outcome === "FAILED_NEGOTIATION") failed++;
    if (record.outcome === "HUMAN_HANDOFF" || record.handoffStatus === "REQUESTED" || record.handoffStatus === "COMPLETED") handoffs++;
    if (record.technicalStatus !== "SUCCESS" || record.outcome === "TECHNICAL_ERROR") technical++;
  }
  return { totalCalls: records.length, fmcsaverified: verified, fmcsaDenominator: denominator, fmcsaVerificationRate: denominator ? verified / denominator : null, loadsMatched: matched, demoBookings, failedNegotiations: failed, handoffs, technicalErrors: technical };
}
