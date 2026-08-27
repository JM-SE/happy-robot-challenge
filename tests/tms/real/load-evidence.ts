import { mkdir, writeFile } from "node:fs/promises";
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
const REPORT_PATH = join(REPORT_DIRECTORY, "real-read-only-loads.json");
const SENSITIVE_FIELDS = /AUTH|TOKEN|SECRET|PASSWORD|API_KEY|MAX_BUY|NOTES|COMMODITY|DIMS/i;

function safeFieldNames(fieldNames: string[][] | undefined): string[][] | undefined {
  return fieldNames?.map((fields) => fields.filter((field) => !SENSITIVE_FIELDS.test(field)));
}

export function sanitizeRealLoadEvidence(probe: SanitizedRealLoadProbeEvidence): SanitizedRealLoadProbeEvidence {
  return {
    ...probe,
    fieldNames: safeFieldNames(probe.fieldNames),
  };
}

export async function writeSanitizedRealLoadEvidence(probes: SanitizedRealLoadProbeEvidence[]): Promise<void> {
  await mkdir(REPORT_DIRECTORY, { recursive: true });
  await writeFile(REPORT_PATH, `${JSON.stringify({
    handbook: "HR-LTMS-PR-001",
    environment: "candidate-non-production",
    runner: "test:real-tms:loads",
    generatedAt: new Date().toISOString(),
    probes: probes.map((probe) => ({
      ...sanitizeRealLoadEvidence(probe),
    })),
  }, null, 2)}\n`, "utf8");
}
