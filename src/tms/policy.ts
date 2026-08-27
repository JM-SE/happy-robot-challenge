import { TmsConfigurationError } from "./errors";
import { TMS_MODES, type TmsConfig } from "./types";

export const REAL_TMS_ALLOWED_COMMAND = "DEBUG_ECHO";

export function assertTmsCommandAllowed(config: TmsConfig, command: string): void {
  if (config.mode === TMS_MODES.REAL && command !== REAL_TMS_ALLOWED_COMMAND) {
    throw new TmsConfigurationError("The real TMS mode permits DEBUG_ECHO only.");
  }
}

export function assertRealTmsMode(config: TmsConfig): void {
  if (config.mode !== TMS_MODES.REAL) {
    throw new TmsConfigurationError("The real TMS runner requires explicit real non-production activation.");
  }
}
