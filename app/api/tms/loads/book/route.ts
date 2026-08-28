import { errorResponse, readJsonBody } from "../../../../../src/tms/http";
import { assertBookingCallerAuthorized } from "../../../../../src/tms/caller-authorization";
import { TmsCallerAuthorizationError } from "../../../../../src/tms/errors";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await readJsonBody(request);
  } catch (error) {
    return errorResponse(error);
  }

  try {
    assertBookingCallerAuthorized();
  } catch (error) {
    return errorResponse(error);
  }

  // The public mutation surface is intentionally deny-by-default. Controlled
  // booking remains a direct test seam until Phase 3 authority is integrated.
  void body;
  return errorResponse(new TmsCallerAuthorizationError());
}
