import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const REAL_BOOKING_OUTCOMES = {
  SUCCESS: "success",
  DETERMINISTIC_ERROR: "deterministic-error",
  SIDE_EFFECT_UNCERTAIN: "side-effect-uncertain",
  RECONCILED: "reconciled",
  STILL_UNCERTAIN: "still-uncertain",
} as const;

export type RealBookingOutcome = (typeof REAL_BOOKING_OUTCOMES)[keyof typeof REAL_BOOKING_OUTCOMES];

export interface SanitizedBookingEvidence {
  stage: "query" | "selection" | "detail" | "booking" | "reconciliation";
  operation: "LOAD_QUERY" | "LOAD_GET" | "LOAD_BOOK";
  outcome: RealBookingOutcome;
  durationMs: number;
  requestBytes?: number;
  responseBytes?: number;
  recordCount?: number;
  fieldNames?: string[][];
  terminalEnd?: boolean;
  lifecycle?: "peer-close" | "remote-error" | "transport-error" | "not-run";
  errorType?: string;
  remoteCode?: string;
  attemptCount: 0 | 1;
  rollbackAvailable: false;
  reconciliation?: "best-effort" | "not-applicable";
}

const REPORT_DIRECTORY = join(process.cwd(), "reports", "tms", "phase-2c");
const REPORT_PATH = join(REPORT_DIRECTORY, "real-controlled-booking.json");
const ALLOWED_FIELD_NAMES = new Set([
  "LOAD_ID", "ORIG_STATE", "DEST_STATE", "ORIG_CITY", "DEST_CITY", "ORIG_ZIP", "DEST_ZIP",
  "EQTYPE", "RATE", "STATUS", "PICKUP_DT", "DELIVERY_DT", "MILES", "PIECES", "WEIGHT",
  "MC_NUM", "AGREED_RATE", "BOOKING_REF", "BOOKED_AT",
]);

function safeFieldNames(fieldNames: string[][] | undefined): string[][] | undefined {
  return fieldNames?.map((fields) => fields.filter((field) => ALLOWED_FIELD_NAMES.has(field)).sort());
}

export function sanitizeBookingEvidence(evidence: SanitizedBookingEvidence): SanitizedBookingEvidence {
  return { ...evidence, fieldNames: safeFieldNames(evidence.fieldNames) };
}

export async function writeSanitizedBookingEvidence(probes: SanitizedBookingEvidence[]): Promise<void> {
  await mkdir(REPORT_DIRECTORY, { recursive: true });
  await writeFile(REPORT_PATH, `${JSON.stringify({
    handbook: "HR-LTMS-PR-001",
    environment: "candidate-non-production",
    runner: "test:real-tms:booking",
    generatedAt: new Date().toISOString(),
    rollbackAvailable: false,
    probes: probes.map(sanitizeBookingEvidence),
  }, null, 2)}\n`, "utf8");
}
