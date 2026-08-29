import { getAdapterConfig } from "../../../../../src/tms/adapter-config";
import { getTmsConfig } from "../../../../../src/tms/config";
import { TmsClient } from "../../../../../src/tms/client";
import { handleAdapterRequest } from "../../../../../src/tms/http-contract";
import { parseHttpSearch, toHttpPublicLoad } from "../../../../../src/tms/http-dto";
import { searchLoads } from "../../../../../src/tms/service";
import { admitTmsRequest } from "../../../../../src/tms/http-controls";
import { MAX_TMS_DEADLINE_MS } from "../../../../../src/tms/limits";
export const runtime = "nodejs";
export const POST = (request: Request) => handleAdapterRequest(request, async (body) => {
  const input = parseHttpSearch(body);
  getAdapterConfig();
  const client = new TmsClient(getTmsConfig(), undefined, undefined, undefined, { admissionFactory: () => admitTmsRequest({ deadlineMs: MAX_TMS_DEADLINE_MS, rateKey: "LOAD_QUERY" }) });
  return { loads: (await searchLoads(input, client)).map(toHttpPublicLoad) };
});
export const GET = (request: Request) => handleAdapterRequest(request, async () => undefined);
