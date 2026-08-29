export interface TmsLogContext {
  command: string;
  requestId: string;
  durationMs: number;
  outcome: "success" | "error";
  errorType?: string;
  remoteCode?: string;
  recordCount?: number;
}

const OPERATION_BY_COMMAND: Record<string, string> = {
  DEBUG_ECHO: "echo",
  LOAD_QUERY: "search",
  LOAD_GET: "detail",
  LOAD_BOOK: "book",
};

const SAFE_ERROR_TYPES = new Set(["TMS_TIMEOUT", "TMS_PROTOCOL", "TMS_CONNECTION", "TMS_REMOTE", "TMS_UPSTREAM"]);
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,64}$/;

export function logTmsEvent(context: TmsLogContext): void {
  // Construct a closed, bounded event. Never forward the caller's object to the logger.
  const safeContext = {
    operation: OPERATION_BY_COMMAND[context.command] ?? "other",
    requestId: REQUEST_ID_PATTERN.test(context.requestId) ? context.requestId : "invalid",
    durationMs: Number.isFinite(context.durationMs) ? Math.min(600_000, Math.max(0, Math.floor(context.durationMs))) : 0,
    outcome: context.outcome === "success" ? "success" : "error",
    errorType: context.errorType && SAFE_ERROR_TYPES.has(context.errorType) ? context.errorType : undefined,
    recordCount: context.recordCount === undefined ? undefined : Math.min(128, Math.max(0, Math.floor(context.recordCount))),
  };
  console.info("[tms]", safeContext);
}
