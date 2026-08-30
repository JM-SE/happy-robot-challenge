import { isIP } from "node:net";
import { TmsConfigurationError } from "./errors";
import { DEFAULT_TMS_FRAME_BYTES, DEFAULT_TMS_RESPONSE_BYTES, DEFAULT_TMS_RESPONSE_LINE_BYTES, DEFAULT_TMS_RESPONSE_RECORDS, MAX_TMS_CONNECT_TIMEOUT_MS, MAX_TMS_PORT, MAX_TMS_REQUEST_FRAME_BYTES, MAX_TMS_RESPONSE_BYTES, MAX_TMS_RESPONSE_LINE_BYTES, MAX_TMS_RESPONSE_RECORDS, MAX_TMS_RESPONSE_TIMEOUT_MS } from "./limits";
import { TMS_MODES, type TmsConfig, type TmsMode, type TmsResponseLimits } from "./types";
import { type TargetAuthority, type ValidatedRealTarget } from "./target-authority";

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

function targetPin(host: string, port: number): string {
  return `${host}:${port}`;
}

function approvedTargets(env: NodeJS.ProcessEnv): readonly string[] {
  const values = required(env, "TMS_REAL_TARGET_ALLOWLIST")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (values.length === 0 || values.some((value) => value.length > 255)) {
    throw new TmsConfigurationError("The real TMS target allowlist is invalid.");
  }
  return [...new Set(values)];
}

function isLoopbackHost(host: string): boolean {
  return host === "localhost" || (isIP(host) === 4 && host.startsWith("127.")) || host === "::1";
}

export function getTmsConfig(env: NodeJS.ProcessEnv = process.env, targetAuthority?: TargetAuthority): TmsConfig & { validatedTarget?: ValidatedRealTarget } {
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

  const responseLimit = (name: string, fallback: number, maximum: number): number => env[name]?.trim()
    ? positiveInteger(env[name]!, name, maximum)
    : fallback;
  const responseLimits: TmsResponseLimits = {
    maxBytes: responseLimit("TMS_MAX_RESPONSE_BYTES", DEFAULT_TMS_RESPONSE_BYTES, MAX_TMS_RESPONSE_BYTES),
    maxLineBytes: responseLimit("TMS_MAX_RESPONSE_LINE_BYTES", DEFAULT_TMS_RESPONSE_LINE_BYTES, MAX_TMS_RESPONSE_LINE_BYTES),
    maxRecords: responseLimit("TMS_MAX_RESPONSE_RECORDS", DEFAULT_TMS_RESPONSE_RECORDS, MAX_TMS_RESPONSE_RECORDS),
  };

  const host = required(env, "TMS_HOST");
  if (mode === TMS_MODES.MOCK && !isLoopbackHost(host)) {
    throw new TmsConfigurationError("Mock TMS mode requires a loopback target.");
  }

  const port = positiveInteger(required(env, "TMS_PORT"), "TMS_PORT", MAX_TMS_PORT);
  const realTargetPin = mode === TMS_MODES.REAL ? required(env, "TMS_REAL_TARGET_PIN") : undefined;
  const realApprovedTargets = mode === TMS_MODES.REAL ? approvedTargets(env) : undefined;
  if (mode === TMS_MODES.REAL && realTargetPin !== targetPin(host, port)) {
    throw new TmsConfigurationError("The real TMS target does not match the approved target pin.");
  }
  if (mode === TMS_MODES.REAL && !realApprovedTargets?.includes(targetPin(host, port))) {
    throw new TmsConfigurationError("The real TMS target is not in the approved target allowlist.");
  }
  const validatedTarget = mode === TMS_MODES.REAL
    ? (() => {
      if (!targetAuthority) throw new TmsConfigurationError("Real TMS target authority is required.");
      const target = targetAuthority.authorize({ host, port });
      if (target.targetPin !== targetPin(host, port)) throw new TmsConfigurationError("The real TMS target authority rejected the target.");
      return target;
    })()
    : undefined;
  if (mode === TMS_MODES.REAL && env.TMS_REAL_TRANSPORT_APPROVED !== "true") {
    throw new TmsConfigurationError("Real TMS transport requires explicit private-network approval.");
  }

  return {
    mode,
    host,
    port,
    authToken: required(env, "TMS_AUTH_TOKEN"),
    connectTimeoutMs: positiveInteger(required(env, "TMS_CONNECT_TIMEOUT_MS"), "TMS_CONNECT_TIMEOUT_MS", MAX_TMS_CONNECT_TIMEOUT_MS),
    responseTimeoutMs: positiveInteger(required(env, "TMS_RESPONSE_TIMEOUT_MS"), "TMS_RESPONSE_TIMEOUT_MS", MAX_TMS_RESPONSE_TIMEOUT_MS),
    maxFrameBytes: maxFrame,
    maxRequestBytes: maxFrame,
    responseLimits,
    // Legacy env assertions are deliberately not copied into the runtime
    // config as authority. Only the independently-issued target can cross
    // the real transport boundary.
    ...(validatedTarget ? { validatedTarget } : {}),
  };
}
