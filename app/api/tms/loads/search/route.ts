import { getTmsConfig } from "../../../../../src/tms/config";
import { TmsClient } from "../../../../../src/tms/client";
import { errorResponse, json, readJsonBody } from "../../../../../src/tms/http";
import { parseLoadQueryInput } from "../../../../../src/tms/loads";
import { searchLoads } from "../../../../../src/tms/service";
import { admitTmsRequest } from "../../../../../src/tms/http-controls";
import { MAX_TMS_DEADLINE_MS } from "../../../../../src/tms/limits";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await readJsonBody(request);
  } catch (error) {
    return errorResponse(error);
  }

  try {
    const input = parseLoadQueryInput(body);
    const client = new TmsClient(getTmsConfig(), undefined, undefined, undefined, {
      admissionFactory: () => admitTmsRequest({ deadlineMs: MAX_TMS_DEADLINE_MS, rateKey: "LOAD_QUERY" }),
    });
    const loads = await searchLoads(input, client);
    return json({ ok: true, data: { loads } }, 200);
  } catch (error) {
    return errorResponse(error);
  }
}
