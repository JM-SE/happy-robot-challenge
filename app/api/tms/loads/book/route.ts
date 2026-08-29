import { getAdapterConfig } from "../../../../../src/tms/adapter-config";
import { handleAdapterRequest, HttpContractError } from "../../../../../src/tms/http-contract";
import { parseHttpBooking } from "../../../../../src/tms/http-dto";
export const runtime = "nodejs";
export const POST = (request: Request) => handleAdapterRequest(request, async (body) => {
  const input = parseHttpBooking(body);
  const config = getAdapterConfig();
  void input;
  // There is deliberately no client, port, capability, or LOAD_BOOK call here.
  throw new HttpContractError(403, config.mode === "real" ? "REAL_BOOKING_DISABLED" : "POLICY_DENIED", config.mode === "real" ? "Booking is disabled." : "The operation is not permitted.");
});
export const GET = (request: Request) => handleAdapterRequest(request, async () => undefined);
