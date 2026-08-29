import "server-only";
import { TmsConfigurationError } from "./errors";

export type AdapterMode = "mock" | "real";
export interface AdapterConfig { mode: AdapterMode; sharedSecret: string; realBookingEnabled: false; }

export function getAdapterConfig(env: NodeJS.ProcessEnv = process.env): AdapterConfig {
  const mode = env.ADAPTER_MODE === undefined ? "mock" : env.ADAPTER_MODE.trim();
  if (mode !== "mock" && mode !== "real") throw new TmsConfigurationError("Invalid adapter mode.");
  if (mode === "real" && env.TMS_MODE !== "real") throw new TmsConfigurationError("Real adapter mode requires real TMS mode.");
  if (mode === "mock" && env.TMS_MODE !== undefined && env.TMS_MODE !== "mock") throw new TmsConfigurationError("Mock adapter mode requires mock TMS mode.");
  const sharedSecret = env.ADAPTER_SHARED_SECRET?.trim();
  if (!sharedSecret) throw new TmsConfigurationError("Missing adapter shared secret.");
  const booking = env.REAL_BOOKING_ENABLED;
  if (booking !== undefined && booking !== "false") throw new TmsConfigurationError("Real booking must remain disabled.");
  return { mode, sharedSecret, realBookingEnabled: false };
}
