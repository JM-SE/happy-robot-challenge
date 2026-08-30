import { livenessResponse, methodNotAllowedResponse } from "../../../src/runtime/health-contract";

export const runtime = "nodejs";

export function GET(): Response {
  return livenessResponse();
}

export function OPTIONS(): Response {
  return methodNotAllowedResponse();
}

export function POST(): Response {
  return methodNotAllowedResponse();
}
