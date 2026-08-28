import { TmsConfigurationError } from "./errors";
import { TMS_MODES, type TmsConfig } from "./types";

export const TMS_EXECUTION_SCOPES = {
  MOCK_LOCAL: "mock-local",
  REAL_2A_ECHO: "real-2a-echo",
  REAL_2B_READ_ONLY: "real-2b-read-only",
  REAL_2C_CONTROLLED_BOOKING: "real-2c-controlled-booking",
} as const;

export type TmsExecutionScope = (typeof TMS_EXECUTION_SCOPES)[keyof typeof TMS_EXECUTION_SCOPES];

export interface TmsCommandPolicy {
  scope: TmsExecutionScope;
}

export const REAL_TMS_ALLOWED_COMMAND = "DEBUG_ECHO";

const COMMANDS_BY_SCOPE: Record<TmsExecutionScope, readonly string[]> = {
  [TMS_EXECUTION_SCOPES.MOCK_LOCAL]: ["DEBUG_ECHO", "LOAD_QUERY", "LOAD_GET", "LOAD_BOOK"],
  [TMS_EXECUTION_SCOPES.REAL_2A_ECHO]: ["DEBUG_ECHO"],
  [TMS_EXECUTION_SCOPES.REAL_2B_READ_ONLY]: ["DEBUG_ECHO", "LOAD_QUERY", "LOAD_GET"],
  [TMS_EXECUTION_SCOPES.REAL_2C_CONTROLLED_BOOKING]: ["LOAD_QUERY", "LOAD_GET", "LOAD_BOOK"],
};

export const REAL_2B_COMMAND_POLICY: TmsCommandPolicy = {
  scope: TMS_EXECUTION_SCOPES.REAL_2B_READ_ONLY,
};

function defaultPolicy(config: TmsConfig): TmsCommandPolicy {
  return { scope: config.mode === TMS_MODES.REAL ? TMS_EXECUTION_SCOPES.REAL_2A_ECHO : TMS_EXECUTION_SCOPES.MOCK_LOCAL };
}

export function assertTmsCommandAllowed(config: TmsConfig, command: string, policy?: TmsCommandPolicy): void {
  const effectivePolicy = policy ?? defaultPolicy(config);
  if (config.mode === TMS_MODES.MOCK && effectivePolicy.scope !== TMS_EXECUTION_SCOPES.MOCK_LOCAL) {
    throw new TmsConfigurationError("Real TMS command scopes require real mode.");
  }
  if (config.mode === TMS_MODES.REAL && effectivePolicy.scope === TMS_EXECUTION_SCOPES.MOCK_LOCAL) {
    throw new TmsConfigurationError("Mock TMS command scope cannot target the real TMS.");
  }
  if (config.mode === TMS_MODES.MOCK && effectivePolicy.scope === TMS_EXECUTION_SCOPES.MOCK_LOCAL) return;
  if (effectivePolicy.scope === TMS_EXECUTION_SCOPES.REAL_2C_CONTROLLED_BOOKING) {
    throw new TmsConfigurationError("Real LOAD_BOOK remains disabled until Phase 3 authority is integrated.");
  }
  if (!COMMANDS_BY_SCOPE[effectivePolicy.scope].includes(command)) {
    throw new TmsConfigurationError(`The TMS execution scope does not permit ${command}.`);
  }
}

export function assertRealTmsMode(config: TmsConfig): void {
  if (config.mode !== TMS_MODES.REAL) {
    throw new TmsConfigurationError("The real TMS runner requires explicit real non-production activation.");
  }
}

export function assertRealBookingTarget(config: TmsConfig): void {
  const target = `${config.host}:${config.port}`;
  if (config.mode !== TMS_MODES.REAL || config.targetPin !== target || !config.approvedTargets?.includes(target) || config.transportApproval !== "private-network") {
    throw new TmsConfigurationError("Real booking requires an approved candidate target and private-network transport approval.");
  }
}
