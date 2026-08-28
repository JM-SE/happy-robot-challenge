import { buildRequest } from "../../../src/tms/protocol";
import { recordToPublicLoad, toLoadDetailFields, toLoadQueryFields } from "../../../src/tms/loads";
import { TmsClient } from "../../../src/tms/client";
import type { LoadDetailInput, LoadPublic, LoadQueryInput, TmsConfig, TmsParsedResponse } from "../../../src/tms/types";
import { REAL_2B_COMMAND_POLICY } from "../../../src/tms/policy";
import type { DeadlineBudget } from "../../../src/tms/deadline";

export interface RealLoadOperationResult {
  response: TmsParsedResponse;
  loads: LoadPublic[];
  requestBytes: number;
}

export async function runRealLoadQuery(config: TmsConfig, input: LoadQueryInput, requestId: string, budget: DeadlineBudget): Promise<RealLoadOperationResult> {
  return budget.runPhase("mapping", async () => {
    const fields = toLoadQueryFields(input);
    const requestBytes = buildRequest({ command: "LOAD_QUERY", authToken: config.authToken, fields }, config.maxFrameBytes).byteLength;
    const response = await new TmsClient(config, undefined, REAL_2B_COMMAND_POLICY, undefined, { budget }).execute({ command: "LOAD_QUERY", fields, requestId });
    return { response, loads: response.records.map(recordToPublicLoad), requestBytes };
  });
}

export async function runRealLoadDetail(config: TmsConfig, input: LoadDetailInput, requestId: string, budget: DeadlineBudget): Promise<RealLoadOperationResult> {
  return budget.runPhase("mapping", async () => {
    const fields = toLoadDetailFields(input);
    const requestBytes = buildRequest({ command: "LOAD_GET", authToken: config.authToken, fields }, config.maxFrameBytes).byteLength;
    const response = await new TmsClient(config, undefined, REAL_2B_COMMAND_POLICY, undefined, { budget }).execute({ command: "LOAD_GET", fields, requestId });
    return { response, loads: response.records.map(recordToPublicLoad), requestBytes };
  });
}
