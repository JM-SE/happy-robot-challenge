import { mkdir, writeFile } from "node:fs/promises";
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

const REPORT_PATH = join(process.cwd(), "reports", "tms", "phase-2a", "real-debug-echo.json");

export async function writeSanitizedRealEvidence(probes: SanitizedRealProbeEvidence[]): Promise<void> {
  await mkdir(join(process.cwd(), "reports", "tms", "phase-2a"), { recursive: true });
  await writeFile(REPORT_PATH, `${JSON.stringify({
    handbook: "HR-LTMS-PR-001",
    environment: "candidate-non-production",
    runner: "test:real-tms:echo",
    generatedAt: new Date().toISOString(),
    probes,
  }, null, 2)}\n`, "utf8");
}
