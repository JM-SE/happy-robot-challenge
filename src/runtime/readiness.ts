import type { RuntimeEnvironment } from "./environment";
import { MAX_RUNTIME_RESOURCE_COUNT } from "./constants";

export type RuntimeReadiness =
  | { readonly kind: "ready" }
  | { readonly kind: "not-ready"; readonly reason: "invalid-environment" | "shutting-down" | "resource-limit" };

export interface ReadinessInput {
  readonly environment: RuntimeEnvironment | undefined;
  readonly shuttingDown?: boolean;
  readonly managedResourceCount?: number;
}

export function evaluateRuntimeReadiness(input: ReadinessInput): RuntimeReadiness {
  if (!input.environment) return { kind: "not-ready", reason: "invalid-environment" };
  if (input.shuttingDown) return { kind: "not-ready", reason: "shutting-down" };
  const resourceCount = input.managedResourceCount ?? 0;
  if (!Number.isSafeInteger(resourceCount) || resourceCount < 0 || resourceCount > MAX_RUNTIME_RESOURCE_COUNT) {
    return { kind: "not-ready", reason: "resource-limit" };
  }
  return { kind: "ready" };
}
