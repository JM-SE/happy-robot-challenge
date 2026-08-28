export type TmsErrorStage = "configuration" | "validation" | "connect" | "write" | "response" | "parse";

export interface TmsErrorMetadata {
  requestId?: string;
  command?: string;
  remoteCode?: string;
  records?: number;
  writeAttempted?: boolean;
}

export class TmsAdapterError extends Error {
  readonly type: string;
  readonly code: string;
  readonly retryable: boolean;
  readonly stage: TmsErrorStage;
  readonly metadata: TmsErrorMetadata;

  constructor(options: {
    type: string;
    code: string;
    message: string;
    retryable: boolean;
    stage: TmsErrorStage;
    metadata?: TmsErrorMetadata;
  }) {
    super(options.message);
    this.name = options.type;
    this.type = options.type;
    this.code = options.code;
    this.retryable = options.retryable;
    this.stage = options.stage;
    this.metadata = options.metadata ?? {};
  }
}

export class TmsConfigurationError extends TmsAdapterError {
  constructor(message: string) {
    super({ type: "TMS_CONFIGURATION", code: "CONFIGURATION_ERROR", message, retryable: false, stage: "configuration" });
  }
}

export class TmsValidationError extends TmsAdapterError {
  constructor(message: string) {
    super({ type: "TMS_VALIDATION", code: "VALIDATION_ERROR", message, retryable: false, stage: "validation" });
  }
}

export class TmsUpstreamError extends TmsAdapterError {
  constructor(message: string) {
    super({
      type: "TMS_UPSTREAM",
      code: "UPSTREAM_RESPONSE_INVALID",
      message,
      retryable: false,
      stage: "response",
    });
  }
}

export class TmsConnectionError extends TmsAdapterError {
  constructor(message: string, stage: "connect" | "write" | "response" = "connect") {
    super({ type: "TMS_CONNECTION", code: "CONNECTION_ERROR", message, retryable: true, stage });
  }
}

export class TmsTimeoutError extends TmsAdapterError {
  constructor(code: "CONNECT_TIMEOUT" | "RESPONSE_TIMEOUT") {
    super({
      type: "TMS_TIMEOUT",
      code,
      message: code === "CONNECT_TIMEOUT"
        ? "The TMS connection timed out."
        : "The TMS did not respond within the configured timeout.",
      retryable: true,
      stage: code === "CONNECT_TIMEOUT" ? "connect" : "response",
    });
  }
}

export class TmsProtocolError extends TmsAdapterError {
  constructor(message: string) {
    super({ type: "TMS_PROTOCOL", code: "PROTOCOL_ERROR", message, retryable: false, stage: "parse" });
  }
}

export class TmsResponseIncompleteError extends TmsAdapterError {
  constructor() {
    super({
      type: "TMS_RESPONSE_INCOMPLETE",
      code: "RESPONSE_INCOMPLETE",
      message: "The TMS connection closed before a complete response was received.",
      retryable: true,
      stage: "response",
    });
  }
}

export class TmsRemoteError extends TmsAdapterError {
  readonly remoteCode: string;

  constructor(remoteCode: string, remoteMessage = "", retryable = true) {
    const safeCode = remoteCode.replace(/[^A-Z0-9_]/g, "_").slice(0, 64) || "UNKNOWN";
    super({
      type: "TMS_REMOTE",
      code: safeCode,
      message: remoteMessage ? `The TMS rejected the request (${safeCode}).` : `The TMS rejected the request (${safeCode}).`,
      retryable: retryable && safeCode === "SERVER_ERROR",
      stage: "response",
      metadata: { remoteCode: safeCode },
    });
    this.remoteCode = safeCode;
  }
}

export function isTmsAdapterError(error: unknown): error is TmsAdapterError {
  return error instanceof TmsAdapterError;
}
