import { randomUUID } from "node:crypto";
import { toBookLoadFields } from "./booking";
import { buildRequest } from "./protocol";
import {
  TmsAdapterError,
  TmsConnectionError,
  TmsConfigurationError,
  TmsRemoteError,
  TmsTimeoutError,
  type TmsWriteDisposition,
} from "./errors";
import { logTmsEvent } from "./logger";
import { LtmsResponseParser } from "./parser";
import { assertTmsCommandAllowed, TMS_EXECUTION_SCOPES, type TmsCommandPolicy } from "./policy";
import { connectTcp, createTlsConnector, type TmsConnect, type TmsSocket } from "./transport";
import { assertValidatedReadOnlyTcpTarget } from "./target-authority";
import type { TmsCommandRequest, TmsConfig, TmsParsedResponse } from "./types";
import { ControlledBookingAuthorization, type ControlledBookingPort } from "./controlled-booking";
import { DeadlineBudget, DeadlineExceededError } from "./deadline";
import { admitTmsRequest, admitTmsRequestWithBudget, type TmsAdmission } from "./http-controls";
import { MAX_TMS_DEADLINE_MS } from "./limits";

export type TmsClientRequest = TmsCommandRequest;

export interface TmsClientOptions {
  readonly rateLimiter?: import("./resource-controls").BoundedTokenBucketRateLimiter;
  readonly semaphore?: import("./resource-controls").RejectingSemaphore;
  readonly deadlineMs?: number;
  readonly admissionFactory?: () => TmsAdmission;
  readonly budget?: DeadlineBudget;
}

const CONTROLLED_BOOKING_CLIENT = Symbol("controlled-booking-client");

export class TmsClient {
  private readonly connect: TmsConnect;
  constructor(
    private readonly config: TmsConfig,
    connect: TmsConnect | undefined = undefined,
    private readonly policy?: TmsCommandPolicy,
    internalClient?: typeof CONTROLLED_BOOKING_CLIENT,
    private readonly options: TmsClientOptions = {},
  ) {
    if (policy?.scope === TMS_EXECUTION_SCOPES.REAL_2C_CONTROLLED_BOOKING && internalClient !== CONTROLLED_BOOKING_CLIENT) {
      throw new TmsConfigurationError("The generic TMS client cannot hold the real booking capability.");
    }
    if (config.mode === "real") {
      // Plain TCP is accepted only for the explicit real read-only scope. It
      // cannot be used by the controlled booking capability.
      if (config.validatedTarget?.transport === "tcp") {
        if (policy?.scope !== TMS_EXECUTION_SCOPES.REAL_2B_READ_ONLY) {
          throw new TmsConfigurationError("Plain TCP is restricted to real read-only TMS operations.");
        }
        assertValidatedReadOnlyTcpTarget(config.validatedTarget);
        this.connect = connectTcp;
      } else {
        // The real TLS transport boundary is never injectable. Test sockets
        // remain available through mock-local configs.
        this.connect = config.validatedTarget
          ? createTlsConnector(config.validatedTarget)
          : () => { throw new TmsConfigurationError("Real TMS transport requires an authority-validated target."); };
      }
    } else this.connect = connect ?? connectTcp;
  }

  execute(request: TmsClientRequest): Promise<TmsParsedResponse> {
    try {
      assertTmsCommandAllowed(this.config, request.command, this.policy);
    } catch (error) {
      return Promise.reject(error);
    }

    const requestId = request.requestId ?? randomUUID();
    let admission: TmsAdmission;
    let ownsBudget = true;
    try {
      if (this.options.admissionFactory) {
        admission = this.options.admissionFactory();
      } else if (this.options.budget) {
        admission = admitTmsRequestWithBudget(this.options.budget, {
          rateLimiter: this.options.rateLimiter,
          semaphore: this.options.semaphore,
          rateKey: request.command,
        });
        ownsBudget = false;
      } else {
        admission = admitTmsRequest({
          rateLimiter: this.options.rateLimiter,
          semaphore: this.options.semaphore,
          deadlineMs: this.options.deadlineMs ?? Math.min(MAX_TMS_DEADLINE_MS, this.config.connectTimeoutMs + this.config.responseTimeoutMs),
          rateKey: request.command,
        });
      }
    } catch (error) {
      return Promise.reject(error);
    }
    const budget = admission.budget;
    const startedAt = Date.now();
    let socket: TmsSocket | undefined;
    let connectTimer: ReturnType<typeof setTimeout> | undefined;
    let responseTimer: ReturnType<typeof setTimeout> | undefined;
    let deadlineListener: (() => void) | undefined;
    let settled = false;
    let connected = false;
    let writeAttempted = false;
    let writeDisposition: TmsWriteDisposition = "not-sent";
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
        if (deadlineListener) budget.signal.removeEventListener("abort", deadlineListener);
        if (ownsBudget) budget.dispose();
        admission.release();
        if (destroy) socket?.destroy();
        const normalized = error instanceof DeadlineExceededError
          ? new TmsTimeoutError(connected ? "RESPONSE_TIMEOUT" : "CONNECT_TIMEOUT")
          : error instanceof TmsAdapterError ? error : new TmsConnectionError("The TMS connection failed.", connected ? "response" : "connect");
        normalized.metadata.writeAttempted = writeAttempted;
        normalized.metadata.writeDisposition = writeDisposition;
        normalized.metadata.command = request.command;
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
        publicError.metadata.command = request.command;
        publicError.metadata.writeAttempted = writeAttempted;
        publicError.metadata.writeDisposition = writeDisposition;
        log("error", publicError);
        reject(publicError);
      };

      const settleSuccess = (result: TmsParsedResponse) => {
        if (settled) return;
        settled = true;
        clearTimers();
        cleanupListeners();
        if (deadlineListener) budget.signal.removeEventListener("abort", deadlineListener);
        if (ownsBudget) budget.dispose();
        admission.release();
        socket?.end();
        log("success", undefined, result.records.length);
        resolve(result);
      };

      const onConnect = () => {
        if (settled || writeAttempted) return;
        connected = true;
        if (connectTimer) clearTimeout(connectTimer);
        try { budget.checkpoint(); } catch (error) { settleError(error); return; }
        responseTimer = setTimeout(() => settleError(new TmsTimeoutError("RESPONSE_TIMEOUT")), Math.min(this.config.responseTimeoutMs, budget.remainingMs()));
        let frame: Buffer;
        try {
          frame = buildRequest({ command: request.command, authToken: this.config.authToken, fields: request.fields }, this.config.maxFrameBytes);
        } catch (error) {
          settleError(error);
          return;
        }
        try {
          budget.checkpoint();
          writeAttempted = true;
          writeDisposition = "unknown";
          socket?.write(frame, (error) => {
            if (error) {
              settleError(new TmsConnectionError("The TMS request could not be written.", "write"));
              return;
            }
            writeDisposition = "sent";
          });
        } catch {
          settleError(new TmsConnectionError("The TMS request could not be written.", "write"));
        }
      };

      const onData = (chunk: unknown) => {
        if (settled) return;
        try {
          budget.checkpoint();
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
            budget.checkpoint();
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
            budget.checkpoint();
            parser.finish();
          } catch (error) {
            settleError(error, false);
          }
        }
      };

      deadlineListener = () => settleError(new TmsTimeoutError(connected ? "RESPONSE_TIMEOUT" : "CONNECT_TIMEOUT"));
      budget.signal.addEventListener("abort", deadlineListener, { once: true });
      connectTimer = setTimeout(() => settleError(new TmsTimeoutError("CONNECT_TIMEOUT")), Math.min(this.config.connectTimeoutMs, budget.remainingMs()));
      try {
        budget.checkpoint();
        socket = this.connect({ host: this.config.host, port: this.config.port });
        socket.once("connect", onConnect);
        socket.on("data", onData);
        socket.once("error", onError);
        socket.once("end", onEnd);
        socket.once("close", onClose);
      } catch (error) {
        settleError(error instanceof DeadlineExceededError ? new TmsTimeoutError("CONNECT_TIMEOUT") : error);
      }
    });
  }
}

/**
 * The only client surface that can issue a real LOAD_BOOK. It is intentionally
 * separate from TmsClient so generic routes, services and runners cannot use a
 * reusable policy to write directly.
 */
class ControlledBookingClient implements ControlledBookingPort {
  private readonly bookingExecutions = new WeakSet<object>();
  private readonly client: TmsClient;

  private constructor(config: TmsConfig, connect: TmsConnect, policy: TmsCommandPolicy, options: TmsClientOptions) {
    this.client = new TmsClient(config, connect, policy, CONTROLLED_BOOKING_CLIENT, options);
  }

  static create(config: TmsConfig, connect: TmsConnect, policy: TmsCommandPolicy, options: TmsClientOptions): ControlledBookingClient {
    return new ControlledBookingClient(config, connect, policy, options);
  }

  execute(request: TmsClientRequest): Promise<TmsParsedResponse> {
    if (request.command === "LOAD_BOOK") {
      return Promise.reject(new TmsConfigurationError("LOAD_BOOK requires the controlled booking authorization path."));
    }
    return this.client.execute(request);
  }

  executeBooking(authorization: ControlledBookingAuthorization): Promise<TmsParsedResponse> {
    if (!ControlledBookingAuthorization.isIssued(authorization) || !authorization.bookingAttemptConsumed || this.bookingExecutions.has(authorization)) {
      return Promise.reject(new TmsConfigurationError("LOAD_BOOK requires a fresh controlled booking authorization."));
    }
    this.bookingExecutions.add(authorization);
    const request: TmsClientRequest = {
      command: "LOAD_BOOK",
      fields: toBookLoadFields({
        loadId: authorization.context.selection.selectedLoadId,
        mcNumber: authorization.context.carrier.mcNumber,
        agreedRate: authorization.context.negotiation.agreedRate,
      }),
      requestId: "phase-2c-booking",
    };
    return this.client.execute(request);
  }
}

export function createControlledBookingPort(
  config: TmsConfig,
  capability: TmsCommandPolicy,
  connect: TmsConnect = connectTcp,
  options: TmsClientOptions = {},
): ControlledBookingPort {
  return ControlledBookingClient.create(config, connect, capability, options);
}
