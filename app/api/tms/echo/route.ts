import { getAdapterConfig } from "../../../../src/tms/adapter-config";
import { getTmsConfig } from "../../../../src/tms/config";
import { TmsClient } from "../../../../src/tms/client";
import { responseToEchoResult } from "../../../../src/tms/echo";
import { handleAdapterRequest } from "../../../../src/tms/http-contract";
import { parseHttpEcho } from "../../../../src/tms/http-dto";
import { admitTmsRequest } from "../../../../src/tms/http-controls";
import { MAX_TMS_DEADLINE_MS } from "../../../../src/tms/limits";
export const runtime = "nodejs";
export const POST = (request: Request) => handleAdapterRequest(request, async (body, context) => {
  const input = parseHttpEcho(body);
  getAdapterConfig();
  const client = new TmsClient(getTmsConfig(), undefined, undefined, undefined, { admissionFactory: () => admitTmsRequest({ deadlineMs: MAX_TMS_DEADLINE_MS, rateKey: "DEBUG_ECHO" }) });
  return responseToEchoResult(await client.execute({ command: "DEBUG_ECHO", fields: { MSG: input.message }, requestId: context.requestId }));
});
export const GET = (request: Request) => handleAdapterRequest(request, async () => undefined);
