import net from "node:net";
import tls from "node:tls";
import { TmsConfigurationError } from "./errors";
import { MAX_TMS_TLS_CA_BYTES, MAX_TMS_TLS_HANDSHAKE_TIMEOUT_MS } from "./limits";
import { assertValidatedRealTarget, type ValidatedRealTarget } from "./target-authority";

export interface TmsSocket {
  on(event: "connect" | "data" | "error" | "end" | "close", listener: (...args: unknown[]) => void): this;
  once(event: "connect" | "error" | "end" | "close", listener: (...args: unknown[]) => void): this;
  removeListener(event: string, listener: (...args: unknown[]) => void): this;
  write(data: Buffer, callback?: (error?: Error | null) => void): boolean;
  end(callback?: () => void): this;
  destroy(): this;
}

export interface TmsConnectOptions {
  host: string;
  port: number;
}

/** Injectable transport seam; a future TLS connector can implement this contract. */
export type TmsConnect = (options: TmsConnectOptions) => TmsSocket;

export const connectTcp: TmsConnect = ({ host, port }) => net.createConnection({ host, port });

export interface TlsConnectOptions {
  readonly handshakeTimeoutMs?: number;
}

/** Production-only connector. Its input is an authority-issued target, not env/config. */
export function connectTls(target: ValidatedRealTarget, options: TlsConnectOptions = {}): TmsSocket {
  assertValidatedRealTarget(target);
  const handshakeTimeoutMs = options.handshakeTimeoutMs ?? MAX_TMS_TLS_HANDSHAKE_TIMEOUT_MS;
  if (!Number.isInteger(handshakeTimeoutMs) || handshakeTimeoutMs <= 0 || handshakeTimeoutMs > MAX_TMS_TLS_HANDSHAKE_TIMEOUT_MS) {
    throw new TmsConfigurationError("The real TMS TLS timeout is invalid.");
  }
  if (typeof target.ca === "string" && Buffer.byteLength(target.ca, "utf8") > MAX_TMS_TLS_CA_BYTES) {
    throw new TmsConfigurationError("The real TMS TLS trust configuration is too large.");
  }
  if (Buffer.isBuffer(target.ca) && target.ca.byteLength > MAX_TMS_TLS_CA_BYTES) {
    throw new TmsConfigurationError("The real TMS TLS trust configuration is too large.");
  }

  return tls.connect({
    host: target.host,
    port: target.port,
    servername: target.serverName,
    rejectUnauthorized: true,
    ...(target.ca === undefined ? {} : { ca: target.ca }),
    timeout: handshakeTimeoutMs,
  }) as unknown as TmsSocket;
}

/** Binds an authority-issued target to the existing injectable client seam. */
export function createTlsConnector(target: ValidatedRealTarget, options: TlsConnectOptions = {}): TmsConnect {
  assertValidatedRealTarget(target);
  return () => connectTls(target, options);
}
