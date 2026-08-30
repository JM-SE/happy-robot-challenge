import { handleAdapterRequest } from "../../../../../src/tms/http-contract";
import { parseHttpDetail } from "../../../../../src/tms/http-dto";
import { executeHttpDetail } from "../../../../../src/tms/server-read-only-adapter";
export const runtime = "nodejs";
export const POST = (request: Request) => handleAdapterRequest(request, async (body, context) => {
  const input = parseHttpDetail(body);
  return executeHttpDetail(input, context.requestId);
});
export const GET = (request: Request) => handleAdapterRequest(request, async () => undefined);
