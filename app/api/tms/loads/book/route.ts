import { getTmsConfig } from "../../../../../src/tms/config";
import { TmsClient } from "../../../../../src/tms/client";
import { bookLoad } from "../../../../../src/tms/service";
import { invalidJsonResponse, errorResponse, json } from "../../../../../src/tms/http";
import { parseBookLoadInput } from "../../../../../src/tms/booking";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalidJsonResponse();
  }

  try {
    const input = parseBookLoadInput(body);
    const result = await bookLoad(input, new TmsClient(getTmsConfig()));
    return json({ ok: true, data: { booking: result } }, 200);
  } catch (error) {
    return errorResponse(error);
  }
}
