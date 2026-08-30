export const DEFAULT_TMS_FRAME_BYTES = 4096;
export const MAX_TMS_REQUEST_FRAME_BYTES = 4096;
export const DEFAULT_TMS_RESPONSE_BYTES = 65_536;
export const MAX_TMS_RESPONSE_BYTES = 1_048_576;
export const DEFAULT_TMS_RESPONSE_LINE_BYTES = 16_384;
export const MAX_TMS_RESPONSE_LINE_BYTES = 65_536;
export const DEFAULT_TMS_RESPONSE_RECORDS = 512;
export const MAX_TMS_RESPONSE_RECORDS = 4_096;
/** Bound used only when retaining a redacted diagnostic line internally. */
export const MAX_TMS_DIAGNOSTIC_LINE_BYTES = 256;
export const MAX_TMS_PORT = 65535;
export const MAX_TMS_CONNECT_TIMEOUT_MS = 30_000;
export const MAX_TMS_RESPONSE_TIMEOUT_MS = 60_000;
export const MAX_TMS_TLS_HANDSHAKE_TIMEOUT_MS = 30_000;
export const MAX_TMS_TLS_CA_BYTES = 64 * 1024;
export const MAX_HTTP_BODY_BYTES = 32 * 1024;
export const MAX_HTTP_TEXT_BYTES = 8 * 1024;
export const MAX_HTTP_REQUEST_ID_LENGTH = 64;

// These are deliberately named and bounded in one place.  Do not derive a
// limit from request data or environment values without applying an upper cap.
export const MAX_HTTP_JSON_DEPTH = 16;
export const MAX_HTTP_JSON_OBJECT_KEYS = 64;
export const MAX_HTTP_JSON_ARRAY_ITEMS = 256;
export const MAX_HTTP_JSON_STRING_BYTES = 8 * 1024;
export const MAX_HTTP_JSON_NUMBER_BYTES = 64;
export const MAX_TMS_RATE_KEYS = 1_024;
export const TMS_RATE_WINDOW_MS = 1_000;
export const TMS_RATE_CAPACITY = 30;
export const TMS_RATE_REFILL_PER_SECOND = 30;
export const MAX_TMS_IN_FLIGHT = 32;
export const MAX_TMS_DEADLINE_MS = 60_000;
