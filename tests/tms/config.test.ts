import { describe, expect, it } from "vitest";
import { getTmsConfig } from "../../src/tms/config";
import { TmsConfigurationError } from "../../src/tms/errors";
import { DEFAULT_TMS_FRAME_BYTES } from "../../src/tms/limits";

const requiredEnv = (): NodeJS.ProcessEnv => ({
  NODE_ENV: "test",
  TMS_HOST: " 127.0.0.1 ",
  TMS_PORT: "9000",
  TMS_AUTH_TOKEN: " test-token ",
  TMS_CONNECT_TIMEOUT_MS: "25",
  TMS_RESPONSE_TIMEOUT_MS: "50",
});

describe("getTmsConfig", () => {
  it("uses the default response frame limit when it is omitted", () => {
    expect(getTmsConfig(requiredEnv())).toEqual({
      mode: "mock",
      host: "127.0.0.1",
      port: 9000,
      authToken: "test-token",
      connectTimeoutMs: 25,
      responseTimeoutMs: 50,
      maxFrameBytes: DEFAULT_TMS_FRAME_BYTES,
    });
  });

  it("accepts the lower positive-integer boundary for each numeric setting", () => {
    const env = requiredEnv();
    env.TMS_PORT = "1";
    env.TMS_CONNECT_TIMEOUT_MS = "1";
    env.TMS_RESPONSE_TIMEOUT_MS = "1";
    env.TMS_MAX_FRAME_BYTES = "1";

    expect(getTmsConfig(env)).toMatchObject({ port: 1, connectTimeoutMs: 1, responseTimeoutMs: 1, maxFrameBytes: 1 });
  });

  it("accepts the highest valid TCP port and rejects values above it", () => {
    const valid = requiredEnv();
    valid.TMS_PORT = "65535";
    expect(getTmsConfig(valid).port).toBe(65535);

    const invalid = requiredEnv();
    invalid.TMS_PORT = "65536";
    expect(() => getTmsConfig(invalid)).toThrow(TmsConfigurationError);
  });

  it("requires the exact real-mode activation triple and returns the real mode", () => {
    const env = requiredEnv();
    env.TMS_MODE = "real";
    env.TMS_ENV = "non-production";
    env.TMS_REAL_ENABLED = "true";

    expect(getTmsConfig(env)).toMatchObject({ mode: "real", maxFrameBytes: DEFAULT_TMS_FRAME_BYTES });
  });

  it.each([
    { TMS_MODE: "real", TMS_ENV: "non-production", TMS_REAL_ENABLED: "false" },
    { TMS_MODE: "REAL", TMS_ENV: "non-production", TMS_REAL_ENABLED: "true" },
    { TMS_MODE: "real", TMS_ENV: "production", TMS_REAL_ENABLED: "true" },
    { TMS_MODE: "real ", TMS_ENV: "non-production", TMS_REAL_ENABLED: "true" },
  ])("rejects non-exact real activation flags %j", (flags) => {
    expect(() => getTmsConfig({ ...requiredEnv(), ...flags })).toThrow(TmsConfigurationError);
  });

  it("rejects a real response frame limit above the handbook request limit", () => {
    expect(() => getTmsConfig({
      ...requiredEnv(),
      TMS_MODE: "real",
      TMS_ENV: "non-production",
      TMS_REAL_ENABLED: "true",
      TMS_MAX_FRAME_BYTES: "4097",
    })).toThrow(TmsConfigurationError);
  });

  it.each(["0", "-1", "1.5", "NaN", "Infinity"])("rejects non-positive or non-integer numeric configuration %j", (value) => {
    for (const name of ["TMS_PORT", "TMS_CONNECT_TIMEOUT_MS", "TMS_RESPONSE_TIMEOUT_MS", "TMS_MAX_FRAME_BYTES"] as const) {
      const env = requiredEnv();
      env[name] = value;
      expect(() => getTmsConfig(env)).toThrow(TmsConfigurationError);
    }
  });
});
