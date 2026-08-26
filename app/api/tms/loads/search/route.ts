import { getTmsConfig } from "../../../../../src/tms/config";
import { TmsClient } from "../../../../../src/tms/client";
import { invalidJsonResponse, errorResponse, json } from "../../../../../src/tms/http";
import { parseLoadQueryInput } from "../../../../../src/tms/loads";
import { searchLoads } from "../../../../../src/tms/service";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalidJsonResponse();
  }

  try {
    const input = parseLoadQueryInput(body);
    const client = new TmsClient(getTmsConfig());
    const loads = await searchLoads(input, client);
    return json({ ok: true, data: { loads } }, 200);
  } catch (error) {
    return errorResponse(error);
  }
}
