import { mkdir, open } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

export const REAL_LOAD_PROBE_OUTCOMES = {
  SUCCESS: "success",
  ERROR: "error",
  PRECONDITION_NOT_MET: "precondition-not-met",
} as const;

export type RealLoadProbeOutcome = (typeof REAL_LOAD_PROBE_OUTCOMES)[keyof typeof REAL_LOAD_PROBE_OUTCOMES];

export interface SanitizedRealLoadProbeEvidence {
  operation: "LOAD_QUERY" | "LOAD_GET";
  outcome: RealLoadProbeOutcome;
  durationMs: number;
  requestBytes?: number;
  responseBytes?: number;
  recordCount?: number;
  recordTypes?: string[];
  fieldNames?: string[][];
  terminalEnd?: boolean;
  lifecycle?: "peer-close" | "remote-error" | "not-run";
  remoteCode?: string;
  reason?: "no-load-id-observed";
}

const REPORT_DIRECTORY = join(process.cwd(), "reports", "tms", "phase-2b");
const ALLOWED_FIELD_NAMES = new Set([
  "LOAD_ID", "STATUS", "ORIG_STATE", "DEST_STATE", "ORIG_CITY", "DEST_CITY", "ORIG_ZIP", "DEST_ZIP",
  "EQTYPE", "PICKUP_DT", "DELIVERY_DT", "MILES", "PIECES", "WEIGHT",
]);
const ALLOWED_EVIDENCE_KEYS = new Set<keyof SanitizedRealLoadProbeEvidence>([
  "operation", "outcome", "durationMs", "requestBytes", "responseBytes", "recordCount", "recordTypes",
  "fieldNames", "terminalEnd", "lifecycle", "remoteCode", "reason",
]);
const MAX_EVIDENCE_RECORDS = 128;
const MAX_EVIDENCE_FIELDS = 32;
const MAX_EVIDENCE_SCALAR = 1_000_000;

function bounded(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    && value <= MAX_EVIDENCE_SCALAR ? Math.floor(value)
    : undefined;
}

function requiredBounded(value: unknown, name: string): number {
  const normalized = bounded(value);
  if (normalized === undefined) throw new Error(`Evidence ${name} must be a bounded nonnegative number.`);
  return normalized;
}

function safeFieldNames(fieldNames: string[][] | undefined): string[][] | undefined {
  if (fieldNames === undefined) return undefined;
  if (!Array.isArray(fieldNames)) throw new Error("Evidence field names must be an array.");
  return fieldNames.slice(0, MAX_EVIDENCE_RECORDS).map((fields) => {
    if (!Array.isArray(fields)) throw new Error("Evidence field names must contain arrays.");
    return fields.slice(0, MAX_EVIDENCE_FIELDS).filter((field): field is string => typeof field === "string" && ALLOWED_FIELD_NAMES.has(field)).sort();
  });
}

export function sanitizeRealLoadEvidence(probe: SanitizedRealLoadProbeEvidence): SanitizedRealLoadProbeEvidence {
  const unknownKeys = Object.keys(probe).filter((key) => !ALLOWED_EVIDENCE_KEYS.has(key as keyof SanitizedRealLoadProbeEvidence));
  if (unknownKeys.length > 0) throw new Error("Evidence contains unknown fields.");
  if (probe.operation !== "LOAD_QUERY" && probe.operation !== "LOAD_GET") throw new Error("Evidence contains an invalid operation.");
  if (!Object.values(REAL_LOAD_PROBE_OUTCOMES).includes(probe.outcome)) throw new Error("Evidence contains an invalid outcome.");
  if (probe.lifecycle !== undefined && !["peer-close", "remote-error", "not-run"].includes(probe.lifecycle)) throw new Error("Evidence contains an invalid lifecycle.");
  return {
    operation: probe.operation,
    outcome: probe.outcome,
     durationMs: requiredBounded(probe.durationMs, "durationMs"),
     ...(probe.requestBytes !== undefined ? { requestBytes: requiredBounded(probe.requestBytes, "requestBytes") } : {}),
     ...(probe.responseBytes !== undefined ? { responseBytes: requiredBounded(probe.responseBytes, "responseBytes") } : {}),
     ...(probe.recordCount !== undefined ? { recordCount: requiredBounded(probe.recordCount, "recordCount") } : {}),
    fieldNames: safeFieldNames(probe.fieldNames),
     ...(probe.recordTypes ? { recordTypes: Array.isArray(probe.recordTypes) && probe.recordTypes.every((value) => typeof value === "string" && /^[A-Z0-9_-]{1,64}$/.test(value)) ? probe.recordTypes.slice(0, MAX_EVIDENCE_RECORDS).sort() : (() => { throw new Error("Evidence record types are invalid."); })() } : {}),
    ...(probe.terminalEnd === true ? { terminalEnd: true } : {}),
    ...(probe.lifecycle ? { lifecycle: probe.lifecycle } : {}),
    ...(probe.remoteCode && /^[A-Z0-9_]{1,64}$/.test(probe.remoteCode) ? { remoteCode: probe.remoteCode } : {}),
    ...(probe.reason === "no-load-id-observed" ? { reason: probe.reason } : {}),
  };
}

export async function writeSanitizedRealLoadEvidence(probes: SanitizedRealLoadProbeEvidence[]): Promise<string> {
  await mkdir(REPORT_DIRECTORY, { recursive: true });
  const reportPath = join(REPORT_DIRECTORY, `real-read-only-loads-${Date.now()}-${randomUUID()}.json`);
  const handle = await open(reportPath, "wx");
  try { await handle.writeFile(`${JSON.stringify({
    handbook: "HR-LTMS-PR-001",
    environment: "candidate-non-production",
    runner: "test:real-tms:loads",
    generatedAt: new Date().toISOString(),
    probes: probes.slice(0, MAX_EVIDENCE_RECORDS).map(sanitizeRealLoadEvidence),
  }, null, 2)}\n`, "utf8"); } finally { await handle.close(); }
  return reportPath;
}
