import { handleAdapterRequest } from "../../../../src/tms/http-contract";
import { parseHttpEcho } from "../../../../src/tms/http-dto";
import { executeHttpEcho } from "../../../../src/tms/server-read-only-adapter";
export const runtime = "nodejs";
export const POST = (request: Request) => handleAdapterRequest(request, async (body, context) => {
  const input = parseHttpEcho(body);
  return executeHttpEcho(input, context.requestId);
});
export const GET = (request: Request) => handleAdapterRequest(request, async () => undefined);
