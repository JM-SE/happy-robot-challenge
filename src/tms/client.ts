import { randomUUID } from "node:crypto";
import { buildRequest } from "./protocol";
import {
  TmsAdapterError,
  TmsConnectionError,
  TmsRemoteError,
  TmsTimeoutError,
} from "./errors";
import { logTmsEvent } from "./logger";
import { LtmsResponseParser } from "./parser";
import { assertTmsCommandAllowed, type TmsCommandPolicy } from "./policy";
import { connectTcp, type TmsConnect, type TmsSocket } from "./transport";
import type { TmsCommandRequest, TmsConfig, TmsParsedResponse } from "./types";

export type TmsClientRequest = TmsCommandRequest;

export class TmsClient {
  constructor(
    private readonly config: TmsConfig,
    private readonly connect: TmsConnect = connectTcp,
    private readonly policy?: TmsCommandPolicy,
  ) {}

  execute(request: TmsClientRequest): Promise<TmsParsedResponse> {
    try {
      assertTmsCommandAllowed(this.config, request.command, this.policy);
    } catch (error) {
      return Promise.reject(error);
    }

    const requestId = request.requestId ?? randomUUID();
    const startedAt = Date.now();
    let socket: TmsSocket | undefined;
    let connectTimer: ReturnType<typeof setTimeout> | undefined;
    let responseTimer: ReturnType<typeof setTimeout> | undefined;
    let settled = false;
    let connected = false;
    let writeStarted = false;
    let terminalResult: TmsParsedResponse | undefined;
    const parser = new LtmsResponseParser(this.config.maxFrameBytes);

    const log = (outcome: "success" | "error", error?: unknown, records?: number) => {
      logTmsEvent({
        command: request.command,
        requestId,
        durationMs: Date.now() - startedAt,
        outcome,
        errorType: error instanceof TmsAdapterError ? error.type : undefined,
        remoteCode: error instanceof TmsAdapterError ? error.metadata.remoteCode : undefined,
        recordCount: records,
      });
    };

    return new Promise<TmsParsedResponse>((resolve, reject) => {
      const clearTimers = () => {
        if (connectTimer) clearTimeout(connectTimer);
        if (responseTimer) clearTimeout(responseTimer);
      };

      const cleanupListeners = () => {
        socket?.removeListener("connect", onConnect);
        socket?.removeListener("data", onData);
        socket?.removeListener("error", onError);
        socket?.removeListener("end", onEnd);
        socket?.removeListener("close", onClose);
      };

      const settleError = (error: unknown, destroy = true) => {
        if (settled) return;
        settled = true;
        clearTimers();
        cleanupListeners();
        if (destroy) socket?.destroy();
        const normalized = error instanceof TmsAdapterError ? error : new TmsConnectionError("The TMS connection failed.", connected ? "response" : "connect");
        const publicError = request.command === "LOAD_BOOK" && normalized.retryable
          ? normalized instanceof TmsRemoteError
            ? new TmsRemoteError(normalized.remoteCode, "", false)
            : new TmsAdapterError({
              type: normalized.type,
              code: normalized.code,
              message: normalized.message,
              retryable: false,
              stage: normalized.stage,
              metadata: normalized.metadata,
            })
          : normalized;
        log("error", publicError);
        reject(publicError);
      };

      const settleSuccess = (result: TmsParsedResponse) => {
        if (settled) return;
        settled = true;
        clearTimers();
        cleanupListeners();
        socket?.end();
        log("success", undefined, result.records.length);
        resolve(result);
      };

      const onConnect = () => {
        if (settled || writeStarted) return;
        connected = true;
        if (connectTimer) clearTimeout(connectTimer);
        responseTimer = setTimeout(() => settleError(new TmsTimeoutError("RESPONSE_TIMEOUT")), this.config.responseTimeoutMs);
        writeStarted = true;
        let frame: Buffer;
        try {
          frame = buildRequest({ command: request.command, authToken: this.config.authToken, fields: request.fields }, this.config.maxFrameBytes);
        } catch (error) {
          settleError(error);
          return;
        }
        try {
          socket?.write(frame, (error) => {
            if (error) settleError(new TmsConnectionError("The TMS request could not be written.", "write"));
          });
        } catch {
          settleError(new TmsConnectionError("The TMS request could not be written.", "write"));
        }
      };

      const onData = (chunk: unknown) => {
        if (settled) return;
        try {
           const result = parser.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
           if (result) terminalResult = result;
        } catch (error) {
          settleError(error);
        }
      };

      const onError = () => settleError(new TmsConnectionError("The TMS connection failed.", connected ? "response" : "connect"));
      const onEnd = () => {
        if (settled) return;
        if (terminalResult) settleSuccess(terminalResult);
        else {
          try {
            parser.finish();
          } catch (error) {
            settleError(error);
          }
        }
      };
      const onClose = () => {
        if (settled) return;
        if (terminalResult) settleSuccess(terminalResult);
        else if (!connected) settleError(new TmsConnectionError("The TMS connection closed before it connected.", "connect"), false);
        else {
          try {
            parser.finish();
          } catch (error) {
            settleError(error, false);
          }
        }
      };

      connectTimer = setTimeout(() => settleError(new TmsTimeoutError("CONNECT_TIMEOUT")), this.config.connectTimeoutMs);
      try {
        socket = this.connect({ host: this.config.host, port: this.config.port });
        socket.once("connect", onConnect);
        socket.on("data", onData);
        socket.once("error", onError);
        socket.once("end", onEnd);
        socket.once("close", onClose);
      } catch (error) {
        settleError(error);
      }
    });
  }
}
