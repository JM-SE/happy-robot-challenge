import { randomUUID } from "node:crypto";
import { buildRequest } from "./protocol";
import {
  TmsAdapterError,
  TmsConnectionError,
  TmsResponseIncompleteError,
  TmsTimeoutError,
} from "./errors";
import { logTmsEvent } from "./logger";
import { LtmsResponseParser } from "./parser";
import { connectTcp, type TmsConnect, type TmsSocket } from "./transport";
import type { TmsCommandRequest, TmsConfig, TmsParsedResponse } from "./types";

export type TmsClientRequest = TmsCommandRequest;

export class TmsClient {
  constructor(private readonly config: TmsConfig, private readonly connect: TmsConnect = connectTcp) {}

  execute(request: TmsClientRequest): Promise<TmsParsedResponse> {
    const requestId = request.requestId ?? randomUUID();
    const startedAt = Date.now();
    let socket: TmsSocket | undefined;
    let connectTimer: ReturnType<typeof setTimeout> | undefined;
    let responseTimer: ReturnType<typeof setTimeout> | undefined;
    let settled = false;
    let connected = false;
    let writeStarted = false;
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
        log("error", normalized);
        reject(normalized);
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
        socket?.write(frame, (error) => {
          if (error) settleError(new TmsConnectionError("The TMS request could not be written.", "write"));
        });
      };

      const onData = (chunk: unknown) => {
        if (settled) return;
        try {
          const result = parser.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
          if (result) settleSuccess(result);
        } catch (error) {
          settleError(error);
        }
      };

      const onError = () => settleError(new TmsConnectionError("The TMS connection failed.", connected ? "response" : "connect"));
      const onEnd = () => {
        if (!settled) settleError(new TmsResponseIncompleteError());
      };
      const onClose = () => {
        if (!settled) settleError(new TmsResponseIncompleteError(), false);
      };

      try {
        socket = this.connect({ host: this.config.host, port: this.config.port });
        socket.once("connect", onConnect);
        socket.on("data", onData);
        socket.once("error", onError);
        socket.once("end", onEnd);
        socket.once("close", onClose);
        connectTimer = setTimeout(() => settleError(new TmsTimeoutError("CONNECT_TIMEOUT")), this.config.connectTimeoutMs);
      } catch (error) {
        settleError(error);
      }
    });
  }
}
