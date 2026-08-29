import "server-only";
import { evaluateAdapterEnvironment, type AdapterMode } from "./config-policy";
import { TmsConfigurationError } from "./errors";

export interface AdapterConfig { mode: AdapterMode; sharedSecret: string; realBookingEnabled: false; }

export function getAdapterConfig(env: NodeJS.ProcessEnv = process.env): AdapterConfig {
  const result = evaluateAdapterEnvironment({
    adapterMode: env.ADAPTER_MODE,
    sharedSecret: env.ADAPTER_SHARED_SECRET,
    tmsMode: env.TMS_MODE,
    realBookingEnabled: env.REAL_BOOKING_ENABLED,
    nodeEnv: env.NODE_ENV,
  });
  if (!result.ok) throw new TmsConfigurationError(result.message);
  return result;
}
