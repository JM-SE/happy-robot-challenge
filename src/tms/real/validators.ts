import "server-only";

import { TmsValidationError } from "../errors";
import type { BookingHandoffClaims } from "./proof";

export function validateBookingBindings(claims: BookingHandoffClaims): BookingHandoffClaims {
  const values = [claims.loadId, claims.runId, claims.sessionId, claims.mcNumber];
  if (values.some((value) => !value || value.length > 128 || /[|\r\n]/.test(value))) {
    throw new TmsValidationError("The booking handoff binding is invalid.");
  }
  if (!Number.isFinite(claims.agreedRate) || claims.agreedRate <= 0) {
    throw new TmsValidationError("The booking handoff rate is invalid.");
  }
  return claims;
}
