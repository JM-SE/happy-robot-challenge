import { mkdir, open } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

export interface SanitizedRealProbeEvidence {
  probe: string;
  outcome: "success" | "error";
  durationMs: number;
  requestBytes: number;
  responseBytes?: number;
  recordCount?: number;
  recordTypes?: string[];
  fieldNames?: string[][];
  terminalEnd: boolean;
  lifecycle: "peer-close" | "remote-error";
  remoteCode?: string;
}

const REPORT_DIRECTORY = join(process.cwd(), "reports", "tms", "phase-2a");
const ALLOWED_FIELD_NAMES = new Set(["MSG", "X", "Y", "Z"]);
const ALLOWED_EVIDENCE_KEYS = new Set<keyof SanitizedRealProbeEvidence>([
  "probe", "outcome", "durationMs", "requestBytes", "responseBytes", "recordCount",
  "recordTypes", "fieldNames", "terminalEnd", "lifecycle", "remoteCode",
]);
const MAX_EVIDENCE_RECORDS = 128;
const MAX_EVIDENCE_FIELDS = 32;
const MAX_EVIDENCE_SCALAR = 1_000_000;

export function sanitizeRealProbeEvidence(probe: SanitizedRealProbeEvidence): SanitizedRealProbeEvidence {
  const unknownKeys = Object.keys(probe).filter((key) => !ALLOWED_EVIDENCE_KEYS.has(key as keyof SanitizedRealProbeEvidence));
  if (unknownKeys.length > 0) throw new Error("Evidence contains unknown fields.");
  if (probe.outcome !== "success" && probe.outcome !== "error") throw new Error("Evidence contains an invalid outcome.");
  if (probe.lifecycle !== "peer-close" && probe.lifecycle !== "remote-error") throw new Error("Evidence contains an invalid lifecycle.");
  const nonNegative = (value: unknown): number | undefined =>
    typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= MAX_EVIDENCE_SCALAR ? Math.floor(value) : undefined;
  const requiredNumber = (value: unknown, name: string): number => {
    const normalized = nonNegative(value);
    if (normalized === undefined) throw new Error(`Evidence ${name} must be a bounded nonnegative number.`);
    return normalized;
  };
  const sanitized: SanitizedRealProbeEvidence = {
    probe: typeof probe.probe === "string" ? probe.probe.slice(0, 64) : "unknown",
    outcome: probe.outcome === "success" ? "success" : "error",
    durationMs: requiredNumber(probe.durationMs, "durationMs"),
    requestBytes: requiredNumber(probe.requestBytes, "requestBytes"),
    terminalEnd: probe.terminalEnd === true,
    lifecycle: probe.lifecycle === "peer-close" ? "peer-close" : "remote-error",
  };
  const responseBytes = probe.responseBytes === undefined ? undefined : requiredNumber(probe.responseBytes, "responseBytes");
  const recordCount = probe.recordCount === undefined ? undefined : requiredNumber(probe.recordCount, "recordCount");
  if (responseBytes !== undefined) sanitized.responseBytes = responseBytes;
  if (recordCount !== undefined) sanitized.recordCount = recordCount;
  if (probe.recordTypes) {
    if (!Array.isArray(probe.recordTypes)) throw new Error("Evidence record types must be an array.");
    sanitized.recordTypes = probe.recordTypes.slice(0, MAX_EVIDENCE_RECORDS).filter((value): value is string => typeof value === "string" && /^[A-Z0-9_-]{1,64}$/.test(value)).sort();
  }
  if (probe.fieldNames) {
    if (!Array.isArray(probe.fieldNames)) throw new Error("Evidence field names must be an array.");
    sanitized.fieldNames = probe.fieldNames.slice(0, MAX_EVIDENCE_RECORDS).map((fields) => {
      if (!Array.isArray(fields)) throw new Error("Evidence field names must contain arrays.");
      return fields.slice(0, MAX_EVIDENCE_FIELDS).filter((field): field is string => typeof field === "string" && ALLOWED_FIELD_NAMES.has(field)).sort();
    });
  }
  if (typeof probe.remoteCode === "string" && /^[A-Z0-9_]{1,64}$/.test(probe.remoteCode)) sanitized.remoteCode = probe.remoteCode;
  return sanitized;
}

export async function writeSanitizedRealEvidence(probes: SanitizedRealProbeEvidence[]): Promise<string> {
  await mkdir(REPORT_DIRECTORY, { recursive: true });
  const reportPath = join(REPORT_DIRECTORY, `real-debug-echo-${Date.now()}-${randomUUID()}.json`);
  const handle = await open(reportPath, "wx");
  try {
    await handle.writeFile(`${JSON.stringify({
    handbook: "HR-LTMS-PR-001",
    environment: "candidate-non-production",
    runner: "test:real-tms:echo",
    generatedAt: new Date().toISOString(),
    probes: probes.slice(0, MAX_EVIDENCE_RECORDS).map(sanitizeRealProbeEvidence),
    }, null, 2)}\n`, "utf8");
  } finally {
    await handle.close();
  }
  return reportPath;
}
