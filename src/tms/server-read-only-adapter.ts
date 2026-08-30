import "server-only";
import { getAdapterConfig } from "./adapter-config";
import { getTmsConfig } from "./config-core";
import { TmsConfigurationError } from "./errors";
import { admitTmsRequest } from "./http-controls";
import { MAX_TMS_DEADLINE_MS } from "./limits";
import { REAL_2B_COMMAND_POLICY } from "./policy";
import { createReadOnlyTcpTargetAuthority } from "./target-authority";
import { TmsClient } from "./client";
import { responseToEchoResult } from "./echo";
import { getLoad, searchLoads } from "./service";
import { mapPublicLoadSummaries, toPublicLoadDetail } from "./public-load-mapper";
import type { EchoResult, LoadDetailInput } from "./types";
import type { PublicSearchRequest } from "./public-contracts";

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new TmsConfigurationError(`Missing real read-only authority configuration: ${name}.`);
  return value;
}

function requiredPort(env: NodeJS.ProcessEnv, name: string): number {
  const value = Number(required(env, name));
  if (!Number.isInteger(value) || value <= 0 || value > 65_535) {
    throw new TmsConfigurationError(`Invalid real read-only authority configuration: ${name}.`);
  }
  return value;
}

function createServerTmsClient(env: NodeJS.ProcessEnv = process.env): TmsClient {
  const adapterConfig = getAdapterConfig(env);
  if (adapterConfig.mode === "real") {
    const authority = createReadOnlyTcpTargetAuthority({
      approvedTargets: [{
        host: required(env, "TMS_REAL_AUTHORITY_HOST"),
        port: requiredPort(env, "TMS_REAL_AUTHORITY_PORT"),
      }],
      egressApproval: "private-network",
    });
    const config = getTmsConfig(env, authority);
    return new TmsClient(config, undefined, REAL_2B_COMMAND_POLICY, undefined, {
      admissionFactory: () => admitTmsRequest({ deadlineMs: MAX_TMS_DEADLINE_MS, rateKey: "TMS_READ_ONLY" }),
    });
  }

  const config = getTmsConfig(env);
  return new TmsClient(config, undefined, undefined, undefined, {
    admissionFactory: () => admitTmsRequest({ deadlineMs: MAX_TMS_DEADLINE_MS, rateKey: "TMS_READ_ONLY" }),
  });
}

export async function executeHttpEcho(input: { message: string }, requestId: string): Promise<EchoResult> {
  const response = await createServerTmsClient().execute({ command: "DEBUG_ECHO", fields: { MSG: input.message }, requestId });
  return responseToEchoResult(response);
}

export async function executeHttpSearch(input: PublicSearchRequest) {
  const loads = await searchLoads(input, createServerTmsClient());
  return { loads: mapPublicLoadSummaries(loads, input.maxResults) };
}

export async function executeHttpDetail(input: LoadDetailInput) {
  const load = await getLoad(input, createServerTmsClient());
  return { load: toPublicLoadDetail(load) };
}
