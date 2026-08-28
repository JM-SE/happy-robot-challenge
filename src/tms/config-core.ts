import { isIP } from "node:net";
import { TmsConfigurationError } from "./errors";
import { DEFAULT_TMS_FRAME_BYTES, MAX_TMS_PORT, MAX_TMS_REQUEST_FRAME_BYTES } from "./limits";
import { TMS_MODES, type TmsConfig, type TmsMode } from "./types";

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (!value?.trim()) throw new TmsConfigurationError(`Missing required TMS configuration: ${name}.`);
  return value.trim();
}

function positiveInteger(value: string, name: string, maximum?: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || (maximum !== undefined && parsed > maximum)) {
    throw new TmsConfigurationError(`Invalid TMS configuration: ${name}.`);
  }
  return parsed;
}

function isLoopbackHost(host: string): boolean {
  return host === "localhost" || (isIP(host) === 4 && host.startsWith("127.")) || host === "::1";
}

export function getTmsConfig(env: NodeJS.ProcessEnv = process.env): TmsConfig {
  const hasActivationFlag = [env.TMS_MODE, env.TMS_ENV, env.TMS_REAL_ENABLED].some((value) => value !== undefined);
  const isMockExplicit = env.TMS_MODE === TMS_MODES.MOCK && env.TMS_ENV === undefined && env.TMS_REAL_ENABLED === undefined;
  const isRealExact = env.TMS_MODE === TMS_MODES.REAL && env.TMS_ENV === "non-production" && env.TMS_REAL_ENABLED === "true";
  const mode: TmsMode = !hasActivationFlag || isMockExplicit
    ? TMS_MODES.MOCK
    : isRealExact
      ? TMS_MODES.REAL
      : (() => { throw new TmsConfigurationError("Invalid TMS real-mode activation flags."); })();

  const maxFrame = env.TMS_MAX_FRAME_BYTES?.trim()
    ? positiveInteger(env.TMS_MAX_FRAME_BYTES, "TMS_MAX_FRAME_BYTES", mode === TMS_MODES.REAL ? MAX_TMS_REQUEST_FRAME_BYTES : undefined)
    : DEFAULT_TMS_FRAME_BYTES;

  const host = required(env, "TMS_HOST");
  if (mode === TMS_MODES.MOCK && !isLoopbackHost(host)) {
    throw new TmsConfigurationError("Mock TMS mode requires a loopback target.");
  }

  return {
    mode,
    host,
    port: positiveInteger(required(env, "TMS_PORT"), "TMS_PORT", MAX_TMS_PORT),
    authToken: required(env, "TMS_AUTH_TOKEN"),
    connectTimeoutMs: positiveInteger(required(env, "TMS_CONNECT_TIMEOUT_MS"), "TMS_CONNECT_TIMEOUT_MS"),
    responseTimeoutMs: positiveInteger(required(env, "TMS_RESPONSE_TIMEOUT_MS"), "TMS_RESPONSE_TIMEOUT_MS"),
    maxFrameBytes: maxFrame,
  };
}
