import { TmsConfigurationError } from "./errors";
import { RateNotAcceptedError } from "./domain-errors";
import type { LoadInternal } from "./types";

export interface BookingRateAuthorizationInput {
  readonly loadId: string;
  readonly agreedRate: number;
  readonly load: LoadInternal;
}

/**
 * Private booking policy seam. Implementations must not expose the ceiling to
 * callers; they only authorize or reject the proposed rate.
 */
export interface BookingRateAuthority {
  authorize(input: BookingRateAuthorizationInput): void;
}

export function createInternalMaxBuyRateAuthority(): BookingRateAuthority {
  return {
    authorize: ({ loadId, agreedRate, load }) => {
      if (load.loadId !== loadId || load.maxBuy === undefined || !Number.isFinite(load.maxBuy)) {
        throw new TmsConfigurationError("Booking rate authority could not verify the selected load.");
      }
      if (!Number.isFinite(agreedRate) || agreedRate <= 0 || agreedRate > load.maxBuy) {
        throw new RateNotAcceptedError();
      }
    },
  };
}
