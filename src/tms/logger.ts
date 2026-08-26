export interface TmsLogContext {
  command: string;
  requestId: string;
  durationMs: number;
  outcome: "success" | "error";
  errorType?: string;
  remoteCode?: string;
  recordCount?: number;
}

export function logTmsEvent(context: TmsLogContext): void {
  // Deliberately log only bounded operational metadata. Never add request fields or auth here.
  console.info("[tms]", context);
}
