import { getAdapterConfig } from "../../../../../src/tms/adapter-config";
import { evaluatePublicBooking, PUBLIC_BOOKING_DECISIONS } from "../../../../../src/tms/config-policy";
import { getProcessMockBookingPort } from "../../../../../src/tms/mock-booking-port";
import { toPublicBookingResult } from "../../../../../src/tms/booking-contract";
import { handleAdapterRequest, HttpContractError } from "../../../../../src/tms/http-contract";
import { parseHttpBooking } from "../../../../../src/tms/http-dto";
export const runtime = "nodejs";
export const POST = (request: Request) => handleAdapterRequest(request, async (body) => {
  const input = parseHttpBooking(body);
  const config = getAdapterConfig();
  if (evaluatePublicBooking(config.mode) === PUBLIC_BOOKING_DECISIONS.REAL_DISABLED) {
    throw new HttpContractError(403, "REAL_BOOKING_DISABLED", "Booking is disabled.");
  }
  const result = await getProcessMockBookingPort().book(input);
  return { booking: toPublicBookingResult(result) };
});
export const GET = (request: Request) => handleAdapterRequest(request, async () => undefined);
