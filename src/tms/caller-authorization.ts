import { TmsCallerAuthorizationError } from "./errors";

/**
 * The public route stays disabled until Phase 3 supplies a trusted caller
 * identity/role/scope adapter. There is deliberately no environment or
 * header-based fixture bypass.
 */
export function assertBookingCallerAuthorized(): never {
  throw new TmsCallerAuthorizationError();
}
