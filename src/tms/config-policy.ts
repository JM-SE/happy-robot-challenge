export const ADAPTER_MODES = {
  MOCK: "mock",
  REAL: "real",
} as const;

export type AdapterMode = (typeof ADAPTER_MODES)[keyof typeof ADAPTER_MODES];

export const CONFIG_FAILURE_CODES = {
  INVALID_MODE: "INVALID_MODE",
  MISSING_SECRET: "MISSING_SECRET",
  WEAK_PRODUCTION_SECRET: "WEAK_PRODUCTION_SECRET",
  MODE_MISMATCH: "MODE_MISMATCH",
  REAL_BOOKING_ENABLED: "REAL_BOOKING_ENABLED",
} as const;

export type ConfigFailureCode = (typeof CONFIG_FAILURE_CODES)[keyof typeof CONFIG_FAILURE_CODES];

export interface AdapterEnvironmentInput {
  adapterMode?: string;
  sharedSecret?: string;
  tmsMode?: string;
  realBookingEnabled?: string;
  nodeEnv?: string;
}

export interface AdapterPolicyFailure {
  ok: false;
  code: ConfigFailureCode;
  message: string;
}

export interface AdapterPolicySuccess {
  ok: true;
  mode: AdapterMode;
  sharedSecret: string;
  realBookingEnabled: false;
}

export type AdapterPolicyResult = AdapterPolicySuccess | AdapterPolicyFailure;

const PRODUCTION_SECRET_MIN_LENGTH = 32;

export function evaluateAdapterEnvironment(input: AdapterEnvironmentInput): AdapterPolicyResult {
  const mode = input.adapterMode === undefined ? ADAPTER_MODES.MOCK : input.adapterMode.trim();
  if (mode !== ADAPTER_MODES.MOCK && mode !== ADAPTER_MODES.REAL) {
    return { ok: false, code: CONFIG_FAILURE_CODES.INVALID_MODE, message: "Invalid adapter mode." };
  }

  const sharedSecret = input.sharedSecret?.trim();
  if (!sharedSecret) {
    return { ok: false, code: CONFIG_FAILURE_CODES.MISSING_SECRET, message: "Missing adapter shared secret." };
  }
  if (input.nodeEnv === "production" && sharedSecret.length < PRODUCTION_SECRET_MIN_LENGTH) {
    return { ok: false, code: CONFIG_FAILURE_CODES.WEAK_PRODUCTION_SECRET, message: "Adapter shared secret is too weak for production." };
  }

  if (mode === ADAPTER_MODES.REAL && input.tmsMode !== ADAPTER_MODES.REAL) {
    return { ok: false, code: CONFIG_FAILURE_CODES.MODE_MISMATCH, message: "Real adapter mode requires real TMS mode." };
  }
  if (mode === ADAPTER_MODES.MOCK && input.tmsMode !== undefined && input.tmsMode !== ADAPTER_MODES.MOCK) {
    return { ok: false, code: CONFIG_FAILURE_CODES.MODE_MISMATCH, message: "Mock adapter mode requires mock TMS mode." };
  }
  if (input.realBookingEnabled !== undefined && input.realBookingEnabled !== "false") {
    return { ok: false, code: CONFIG_FAILURE_CODES.REAL_BOOKING_ENABLED, message: "Real booking must remain disabled." };
  }

  return { ok: true, mode, sharedSecret, realBookingEnabled: false };
}

export const PUBLIC_BOOKING_DECISIONS = {
  MOCK_ALLOWED: "mock-allowed",
  REAL_DISABLED: "real-disabled",
} as const;

export type PublicBookingDecision = (typeof PUBLIC_BOOKING_DECISIONS)[keyof typeof PUBLIC_BOOKING_DECISIONS];

export function evaluatePublicBooking(mode: AdapterMode): PublicBookingDecision {
  return mode === ADAPTER_MODES.MOCK
    ? PUBLIC_BOOKING_DECISIONS.MOCK_ALLOWED
    : PUBLIC_BOOKING_DECISIONS.REAL_DISABLED;
}
