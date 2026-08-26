import { getTmsConfig } from "../../../../../src/tms/config";
import { TmsClient } from "../../../../../src/tms/client";
import { invalidJsonResponse, errorResponse, json } from "../../../../../src/tms/http";
import { parseLoadDetailInput } from "../../../../../src/tms/loads";
import { getLoad } from "../../../../../src/tms/service";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalidJsonResponse();
  }

  try {
    const input = parseLoadDetailInput(body);
    const load = await getLoad(input, new TmsClient(getTmsConfig()));
    return json({ ok: true, data: { load } }, 200);
  } catch (error) {
    return errorResponse(error);
  }
}
