import "server-only";

import { assertRealBookingTarget, assertRealTmsMode } from "../policy";
import { TmsConfigurationError } from "../errors";
import type { TmsConfig } from "../types";

export const REAL_AUTHORITY_KINDS = { PRODUCTION: "production" } as const;
export type RealAuthorityKind = (typeof REAL_AUTHORITY_KINDS)[keyof typeof REAL_AUTHORITY_KINDS];

export interface RealBookingAuthorityInput {
  readonly kind: RealAuthorityKind;
  readonly issuer: string;
  readonly keyId: string;
  readonly approve: (config: TmsConfig) => boolean;
}

export type RealBookingAuthority = RealBookingAuthorityInput;

const TRUSTED_AUTHORITIES = new WeakSet<object>();

export function createServerRealBookingAuthority(input: RealBookingAuthorityInput): RealBookingAuthority {
  if (input.kind !== REAL_AUTHORITY_KINDS.PRODUCTION || !input.issuer.trim() || !input.keyId.trim()) {
    throw new TmsConfigurationError("Real booking authority is unavailable.");
  }
  const authority = Object.freeze({ ...input });
  TRUSTED_AUTHORITIES.add(authority);
  return authority;
}

export function isTrustedRealBookingAuthority(value: unknown): value is RealBookingAuthority {
  return typeof value === "object" && value !== null && TRUSTED_AUTHORITIES.has(value);
}

export function createServerRealBookingCapability(config: TmsConfig, authority: RealBookingAuthority): never {
  assertRealTmsMode(config);
  assertRealBookingTarget(config);
  if (!isTrustedRealBookingAuthority(authority)) throw new TmsConfigurationError("Real booking authority is unavailable.");
  let approved = false;
  try { approved = authority.approve(config); } catch { approved = false; }
  if (authority.kind !== REAL_AUTHORITY_KINDS.PRODUCTION || !authority.issuer || !authority.keyId || !approved) {
    throw new TmsConfigurationError("Real booking authority is unavailable.");
  }
  throw new TmsConfigurationError("Real LOAD_BOOK remains disabled until Phase 3 authority is integrated.");
}
