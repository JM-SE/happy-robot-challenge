import { handleAdapterRequest } from "../../../../../src/tms/http-contract";
import { parseHttpSearch } from "../../../../../src/tms/http-dto";
import { executeHttpSearch } from "../../../../../src/tms/server-read-only-adapter";
export const runtime = "nodejs";
export const POST = (request: Request) => handleAdapterRequest(request, async (body) => {
  const input = parseHttpSearch(body);
  return executeHttpSearch(input);
});
export const GET = (request: Request) => handleAdapterRequest(request, async () => undefined);
