import { isTmsAdapterError, type TmsMappingFailureDetail, type TmsMappingValueShape } from "./errors";

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

const SAFE_ERROR_TYPES = new Set(["TMS_TIMEOUT", "TMS_PROTOCOL", "TMS_CONNECTION", "TMS_RESPONSE_INCOMPLETE", "TMS_REMOTE", "TMS_UPSTREAM"]);
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,64}$/;
const SAFE_MAPPING_CATEGORIES = new Set(["missing-field", "invalid-field", "duplicate-identity"]);
const SAFE_MAPPING_FIELD = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
const SAFE_MAPPING_DETAILS = new Set<TmsMappingFailureDetail>(["non-string", "empty", "length", "pattern", "calendar"]);
const SAFE_MAPPING_SHAPES = new Set<TmsMappingValueShape>(["iso-date", "iso-datetime", "slash-date", "compact-date", "compact-datetime", "other"]);

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
  console.info("[tms]", JSON.stringify(safeContext));
}

export function logTmsMappingFailure(context: {
  operation: "search" | "detail";
  requestId: string;
  error: unknown;
}): void {
  if (!isTmsAdapterError(context.error)) return;
  const mapping = context.error.metadata.mapping;
  if (!mapping || !SAFE_MAPPING_CATEGORIES.has(mapping.category) || !SAFE_MAPPING_FIELD.test(mapping.field)) return;

  const safeMapping = {
    operation: context.operation,
    requestId: REQUEST_ID_PATTERN.test(context.requestId) ? context.requestId : "invalid",
    recordIndex: mapping.recordIndex === undefined ? 0 : Math.min(128, Math.max(0, Math.floor(mapping.recordIndex))),
    category: mapping.category,
    field: mapping.field,
    ...(mapping.detail !== undefined && SAFE_MAPPING_DETAILS.has(mapping.detail) ? { detail: mapping.detail } : {}),
    ...(mapping.shape !== undefined && SAFE_MAPPING_SHAPES.has(mapping.shape) ? { shape: mapping.shape } : {}),
    ...(mapping.observedLength === undefined || !Number.isFinite(mapping.observedLength)
      ? {}
      : { observedLength: Math.min(256, Math.max(0, Math.floor(mapping.observedLength))) }),
  };
  console.warn("[tms-mapping]", JSON.stringify(safeMapping));
}
