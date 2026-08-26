import { TmsConfigurationError } from "./errors";
import type { TmsConfig } from "./types";

const DEFAULT_MAX_FRAME_BYTES = 4096;

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (!value?.trim()) throw new TmsConfigurationError(`Missing required TMS configuration: ${name}.`);
  return value.trim();
}

function positiveInteger(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new TmsConfigurationError(`Invalid TMS configuration: ${name}.`);
  return parsed;
}

export function getTmsConfig(env: NodeJS.ProcessEnv = process.env): TmsConfig {
  const maxFrame = env.TMS_MAX_FRAME_BYTES?.trim()
    ? positiveInteger(env.TMS_MAX_FRAME_BYTES, "TMS_MAX_FRAME_BYTES")
    : DEFAULT_MAX_FRAME_BYTES;

  return {
    host: required(env, "TMS_HOST"),
    port: positiveInteger(required(env, "TMS_PORT"), "TMS_PORT"),
    authToken: required(env, "TMS_AUTH_TOKEN"),
    connectTimeoutMs: positiveInteger(required(env, "TMS_CONNECT_TIMEOUT_MS"), "TMS_CONNECT_TIMEOUT_MS"),
    responseTimeoutMs: positiveInteger(required(env, "TMS_RESPONSE_TIMEOUT_MS"), "TMS_RESPONSE_TIMEOUT_MS"),
    maxFrameBytes: maxFrame,
  };
}
