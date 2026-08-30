import "server-only";

export type RuntimeAdapterMode = "mock" | "real";

export interface RuntimeEnvironment {
  readonly nodeEnvironment: string | undefined;
  readonly adapterMode: RuntimeAdapterMode;
  readonly realBookingEnabled: false;
  readonly hasAdapterSecret: boolean;
}

export type RuntimeEnvironmentFailure =
  | "INVALID_ADAPTER_MODE"
  | "UNSAFE_BOOKING_FLAG";

export type RuntimeEnvironmentResult =
  | { readonly ok: true; readonly environment: RuntimeEnvironment }
  | { readonly ok: false; readonly reason: RuntimeEnvironmentFailure };

export function readRuntimeEnvironment(env: Readonly<Record<string, string | undefined>> = process.env): RuntimeEnvironmentResult {
  const rawMode = env.ADAPTER_MODE?.trim() || "mock";
  if (rawMode !== "mock" && rawMode !== "real") {
    return { ok: false, reason: "INVALID_ADAPTER_MODE" };
  }

  if (env.REAL_BOOKING_ENABLED !== undefined && env.REAL_BOOKING_ENABLED !== "false") {
    return { ok: false, reason: "UNSAFE_BOOKING_FLAG" };
  }

  return {
    ok: true,
    environment: Object.freeze({
      nodeEnvironment: env.NODE_ENV,
      adapterMode: rawMode,
      realBookingEnabled: false as const,
      hasAdapterSecret: Boolean(env.ADAPTER_SHARED_SECRET?.trim()),
    }),
  };
}
