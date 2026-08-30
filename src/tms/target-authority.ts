import { TmsConfigurationError } from "./errors";

export const TARGET_TRANSPORTS = {
  TLS: "tls",
  TCP: "tcp",
} as const;

export const TARGET_EGRESS_APPROVALS = {
  PRIVATE_NETWORK: "private-network",
} as const;

export type TargetTransport = (typeof TARGET_TRANSPORTS)[keyof typeof TARGET_TRANSPORTS];
export type TargetEgressApproval = (typeof TARGET_EGRESS_APPROVALS)[keyof typeof TARGET_EGRESS_APPROVALS];

export interface TargetCandidate {
  readonly host: string;
  readonly port: number;
}

export interface ValidatedRealTarget {
  readonly host: string;
  readonly port: number;
  readonly serverName: string;
  readonly targetPin: string;
  readonly egressApproval: TargetEgressApproval;
  readonly transport: TargetTransport;
  readonly ca?: string | Buffer;
  /** Plain TCP targets are restricted to the real read-only scope. */
  readonly readOnly?: true;
}

/** This object must come from a server-side manifest/provider, never from request env. */
export interface TargetAuthority {
  authorize(candidate: TargetCandidate): ValidatedRealTarget;
}

export interface TargetAuthorityManifest {
  readonly approvedTargets: readonly {
    readonly host: string;
    readonly port: number;
    readonly serverName: string;
    readonly ca?: string | Buffer;
  }[];
  readonly egressApproval: TargetEgressApproval;
}

const TRUSTED_VALIDATED_TARGETS = new WeakSet<object>();

export function createTargetAuthority(manifest: TargetAuthorityManifest): TargetAuthority {
  if (manifest.egressApproval !== TARGET_EGRESS_APPROVALS.PRIVATE_NETWORK || manifest.approvedTargets.length === 0) {
    throw new TmsConfigurationError("The real TMS target authority is unavailable.");
  }

  const entries = manifest.approvedTargets.map((entry) => ({ ...entry }));
  return {
    authorize(candidate) {
      const entry = entries.find((approved) => approved.host === candidate.host && approved.port === candidate.port);
      if (!entry || !entry.serverName.trim()) {
        throw new TmsConfigurationError("The real TMS target authority rejected the target.");
      }
      const validatedTarget = Object.freeze({
        host: entry.host,
        port: entry.port,
        serverName: entry.serverName,
        targetPin: `${entry.host}:${entry.port}`,
        egressApproval: manifest.egressApproval,
        transport: TARGET_TRANSPORTS.TLS,
        ...(entry.ca === undefined ? {} : { ca: entry.ca }),
      });
      TRUSTED_VALIDATED_TARGETS.add(validatedTarget);
      return validatedTarget;
    },
  };
}

export interface ReadOnlyTcpTargetAuthorityManifest {
  readonly approvedTargets: readonly {
    readonly host: string;
    readonly port: number;
  }[];
  readonly egressApproval: TargetEgressApproval;
}

/**
 * Creates the narrower authority required by the legacy plaintext TMS protocol.
 * It cannot issue a booking-capable target and is accepted only by the
 * REAL_2B_READ_ONLY client composition.
 */
export function createReadOnlyTcpTargetAuthority(manifest: ReadOnlyTcpTargetAuthorityManifest): TargetAuthority {
  if (manifest.egressApproval !== TARGET_EGRESS_APPROVALS.PRIVATE_NETWORK || manifest.approvedTargets.length === 0) {
    throw new TmsConfigurationError("The real read-only TCP target authority is unavailable.");
  }

  const entries = manifest.approvedTargets.map((entry) => ({ ...entry }));
  return {
    authorize(candidate) {
      const entry = entries.find((approved) => approved.host === candidate.host && approved.port === candidate.port);
      if (!entry) throw new TmsConfigurationError("The real read-only TCP target authority rejected the target.");
      const validatedTarget = Object.freeze({
        host: entry.host,
        port: entry.port,
        serverName: entry.host,
        targetPin: `${entry.host}:${entry.port}`,
        egressApproval: manifest.egressApproval,
        transport: TARGET_TRANSPORTS.TCP,
        readOnly: true as const,
      });
      TRUSTED_VALIDATED_TARGETS.add(validatedTarget);
      return validatedTarget;
    },
  };
}

export function assertValidatedRealTarget(target: ValidatedRealTarget): void {
  if (typeof target !== "object" || target === null || !TRUSTED_VALIDATED_TARGETS.has(target)) {
    throw new TmsConfigurationError("The real TMS target authority is invalid.");
  }
  if (
    target.transport !== TARGET_TRANSPORTS.TLS ||
    target.egressApproval !== TARGET_EGRESS_APPROVALS.PRIVATE_NETWORK ||
    target.targetPin !== `${target.host}:${target.port}` ||
    !target.serverName.trim()
  ) {
    throw new TmsConfigurationError("The real TMS target authority is invalid.");
  }
}

export function assertValidatedReadOnlyTcpTarget(target: ValidatedRealTarget): void {
  if (typeof target !== "object" || target === null || !TRUSTED_VALIDATED_TARGETS.has(target)) {
    throw new TmsConfigurationError("The real read-only TCP target authority is invalid.");
  }
  if (
    target.transport !== TARGET_TRANSPORTS.TCP ||
    target.readOnly !== true ||
    target.egressApproval !== TARGET_EGRESS_APPROVALS.PRIVATE_NETWORK ||
    target.targetPin !== `${target.host}:${target.port}`
  ) {
    throw new TmsConfigurationError("The real read-only TCP target authority is invalid.");
  }
}
