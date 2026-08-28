import { mkdir, open } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { TmsConfigurationError } from "../../../src/tms/errors";

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

const REPORT_DIRECTORY = join(process.cwd(), "reports", "tms", "phase-2c", "remediation");
const ALLOWED_FIELD_NAMES = new Set([
  "ORIG_STATE", "DEST_STATE", "ORIG_CITY", "DEST_CITY", "ORIG_ZIP", "DEST_ZIP",
  "EQTYPE", "STATUS", "PICKUP_DT", "DELIVERY_DT", "MILES", "PIECES", "WEIGHT",
]);
const ALLOWED_EVIDENCE_KEYS = new Set<keyof SanitizedBookingEvidence>([
  "stage", "operation", "outcome", "durationMs", "requestBytes", "responseBytes", "recordCount",
  "fieldNames", "terminalEnd", "lifecycle", "errorType", "remoteCode", "attemptCount", "rollbackAvailable", "reconciliation",
]);
const MAX_EVIDENCE_RECORDS = 128;
const MAX_EVIDENCE_FIELDS = 32;
const MAX_EVIDENCE_SCALAR = 1_000_000;

function boundedNonNegative(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    && value <= MAX_EVIDENCE_SCALAR ? Math.floor(value)
    : undefined;
}

function requiredBounded(value: unknown, name: string): number {
  const normalized = boundedNonNegative(value);
  if (normalized === undefined) throw new TmsConfigurationError(`Evidence ${name} must be a bounded nonnegative number.`);
  return normalized;
}

function safeFieldNames(fieldNames: string[][] | undefined): string[][] | undefined {
  if (fieldNames === undefined) return undefined;
  if (!Array.isArray(fieldNames)) throw new TmsConfigurationError("Evidence field names must be an array.");
  return fieldNames.slice(0, MAX_EVIDENCE_RECORDS).map((fields) => {
    if (!Array.isArray(fields)) throw new TmsConfigurationError("Evidence field names must contain arrays.");
    return fields.slice(0, MAX_EVIDENCE_FIELDS).filter((field): field is string => typeof field === "string" && ALLOWED_FIELD_NAMES.has(field)).sort();
  });
}

export function sanitizeBookingEvidence(evidence: SanitizedBookingEvidence): SanitizedBookingEvidence {
  const unknownKeys = Object.keys(evidence).filter((key) => !ALLOWED_EVIDENCE_KEYS.has(key as keyof SanitizedBookingEvidence));
  if (unknownKeys.length > 0) throw new TmsConfigurationError("Evidence contains unknown fields.");
  if (!["query", "selection", "detail", "booking", "reconciliation"].includes(evidence.stage)
    || !["LOAD_QUERY", "LOAD_GET", "LOAD_BOOK"].includes(evidence.operation)
    || !Object.values(REAL_BOOKING_OUTCOMES).includes(evidence.outcome)) {
    throw new TmsConfigurationError("Evidence contains an invalid stage, operation or outcome.");
  }

  const sanitized: SanitizedBookingEvidence = {
    stage: evidence.stage,
    operation: evidence.operation,
    outcome: evidence.outcome,
     durationMs: requiredBounded(evidence.durationMs, "durationMs"),
     attemptCount: evidence.attemptCount === 1 ? 1 : evidence.attemptCount === 0 ? 0 : (() => { throw new TmsConfigurationError("Evidence attemptCount is invalid."); })(),
    rollbackAvailable: false,
    reconciliation: evidence.reconciliation === "best-effort" ? "best-effort" : "not-applicable",
    lifecycle: evidence.lifecycle === "peer-close" || evidence.lifecycle === "remote-error" || evidence.lifecycle === "transport-error" || evidence.lifecycle === "not-run"
      ? evidence.lifecycle
      : "not-run",
  };

  const optionalNonNegative = (value: number | undefined, name: string): number | undefined =>
    value === undefined ? undefined : requiredBounded(value, name);
   const requestBytes = optionalNonNegative(evidence.requestBytes, "requestBytes");
   const responseBytes = optionalNonNegative(evidence.responseBytes, "responseBytes");
   const recordCount = optionalNonNegative(evidence.recordCount, "recordCount");
  if (requestBytes !== undefined) sanitized.requestBytes = requestBytes;
  if (responseBytes !== undefined) sanitized.responseBytes = responseBytes;
  if (recordCount !== undefined) sanitized.recordCount = recordCount;
  if (evidence.terminalEnd === true) sanitized.terminalEnd = true;
  const fieldNames = safeFieldNames(evidence.fieldNames);
  if (fieldNames !== undefined) sanitized.fieldNames = fieldNames;
  if (typeof evidence.errorType === "string" && /^TMS_[A-Z0-9_]{1,63}$/.test(evidence.errorType)) sanitized.errorType = evidence.errorType;
  if (typeof evidence.remoteCode === "string" && /^[A-Z0-9_]{1,64}$/.test(evidence.remoteCode)) sanitized.remoteCode = evidence.remoteCode;
  return sanitized;
}

export async function writeSanitizedBookingEvidence(probes: SanitizedBookingEvidence[], directory = REPORT_DIRECTORY): Promise<string> {
  await mkdir(directory, { recursive: true });
  const reportPath = join(directory, `real-controlled-booking-${Date.now()}-${randomUUID()}.json`);
  const content = `${JSON.stringify({
    handbook: "HR-LTMS-PR-001",
    environment: "candidate-non-production",
    runner: "test:real-tms:booking",
    provenance: "sanitized-real-tms-phase-2c-runner-output",
    generatedAt: new Date().toISOString(),
    schemaVersion: 1,
    rollbackAvailable: false,
    probes: probes.slice(0, MAX_EVIDENCE_RECORDS).map(sanitizeBookingEvidence),
  }, null, 2)}\n`;
  const handle = await open(reportPath, "wx");
  try {
    await handle.writeFile(content, "utf8");
  } finally {
    await handle.close();
  }
  return reportPath;
}
