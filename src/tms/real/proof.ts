import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { TmsValidationError } from "../errors";
import { validateBookingBindings } from "./validators";

export const HANDOFF_PROOF_VERSIONS = { V1: 1 } as const;
export const HANDOFF_PROOF_KINDS = { BOOKING: "booking" } as const;
export const HANDOFF_PROOF_ALGORITHMS = { HMAC_SHA256: "hmac-sha256" } as const;

export type HandoffProofVersion = (typeof HANDOFF_PROOF_VERSIONS)[keyof typeof HANDOFF_PROOF_VERSIONS];
export type HandoffProofKind = (typeof HANDOFF_PROOF_KINDS)[keyof typeof HANDOFF_PROOF_KINDS];
export type HandoffProofAlgorithm = (typeof HANDOFF_PROOF_ALGORITHMS)[keyof typeof HANDOFF_PROOF_ALGORITHMS];

export interface BookingHandoffClaims {
  readonly loadId: string;
  readonly runId: string;
  readonly sessionId: string;
  readonly mcNumber: string;
  readonly agreedRate: number;
}

export interface HandoffProofEnvelope {
  readonly version: HandoffProofVersion;
  readonly kind: HandoffProofKind;
  readonly algorithm: HandoffProofAlgorithm;
  readonly issuer: string;
  readonly keyId: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly nonce: string;
  readonly claims: BookingHandoffClaims;
  readonly signature: string;
}

export interface HandoffProofVerifier {
  verify(envelope: HandoffProofEnvelope, canonicalPayload: string): Promise<boolean> | boolean;
}

export interface HandoffNonceStore {
  claim(nonce: string, expiresAt: number): Promise<boolean> | boolean;
}

export interface HandoffProofAuthority {
  readonly issuer: string;
  readonly keyId: string;
  readonly verifier: HandoffProofVerifier;
  readonly nonces: HandoffNonceStore;
}

export interface VerifiedBookingHandoff {
  readonly claims: BookingHandoffClaims;
}

const TRUSTED_PROOF_AUTHORITIES = new WeakSet<object>();

export function createHandoffProofAuthority(input: HandoffProofAuthority): HandoffProofAuthority {
  if (!input.issuer.trim() || !input.keyId.trim()) throw new TmsValidationError("The booking proof authority is invalid.");
  const authority = Object.freeze({ ...input });
  TRUSTED_PROOF_AUTHORITIES.add(authority);
  return authority;
}

function isTrustedProofAuthority(value: unknown): value is HandoffProofAuthority {
  return typeof value === "object" && value !== null && TRUSTED_PROOF_AUTHORITIES.has(value);
}

export interface VerifyBookingHandoffInput {
  readonly envelope: unknown;
  readonly expected: BookingHandoffClaims;
  readonly authority?: HandoffProofAuthority;
  readonly now?: number;
  readonly maxTtlMs?: number;
}

const DEFAULT_MAX_TTL_MS = 30_000;
const VERIFIED_HANDOFFS = new WeakSet<object>();

function fail(): never {
  throw new TmsValidationError("The booking handoff proof is invalid.");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isClaims(value: unknown): value is BookingHandoffClaims {
  return isRecord(value)
    && typeof value.loadId === "string" && typeof value.runId === "string"
    && typeof value.sessionId === "string" && typeof value.mcNumber === "string"
    && typeof value.agreedRate === "number" && Number.isFinite(value.agreedRate);
}

export function canonicalizeHandoffPayload(envelope: HandoffProofEnvelope): string {
  return JSON.stringify({
    version: envelope.version, kind: envelope.kind, algorithm: envelope.algorithm,
    issuer: envelope.issuer, keyId: envelope.keyId, issuedAt: envelope.issuedAt,
    expiresAt: envelope.expiresAt, nonce: envelope.nonce, claims: envelope.claims,
  });
}

export async function verifyBookingHandoff(input: VerifyBookingHandoffInput): Promise<VerifiedBookingHandoff> {
  const authority = input.authority;
  const value = input.envelope;
  if (!isTrustedProofAuthority(authority) || !isRecord(value) || !isClaims(value.claims)) fail();
  const envelope = value as unknown as HandoffProofEnvelope;
  const now = input.now ?? Date.now();
  const maxTtlMs = input.maxTtlMs ?? DEFAULT_MAX_TTL_MS;
  if (envelope.version !== HANDOFF_PROOF_VERSIONS.V1 || envelope.kind !== HANDOFF_PROOF_KINDS.BOOKING
    || envelope.algorithm !== HANDOFF_PROOF_ALGORITHMS.HMAC_SHA256 || envelope.issuer !== authority.issuer
    || envelope.keyId !== authority.keyId || typeof envelope.signature !== "string"
    || typeof envelope.nonce !== "string" || !envelope.nonce || !Number.isFinite(envelope.issuedAt)
    || !Number.isFinite(envelope.expiresAt) || envelope.issuedAt > now || envelope.expiresAt <= now
    || envelope.expiresAt - envelope.issuedAt > maxTtlMs) fail();
  const expected = input.expected;
  const claims = envelope.claims;
  try { validateBookingBindings(expected); validateBookingBindings(claims); } catch { fail(); }
  if (claims.loadId !== expected.loadId || claims.runId !== expected.runId || claims.sessionId !== expected.sessionId
    || claims.mcNumber !== expected.mcNumber || claims.agreedRate !== expected.agreedRate) fail();
  let valid = false;
  try { valid = await authority.verifier.verify(envelope, canonicalizeHandoffPayload(envelope)); } catch { fail(); }
  if (!valid) fail();
  let claimed = false;
  try { claimed = await authority.nonces.claim(envelope.nonce, envelope.expiresAt); } catch { fail(); }
  if (!claimed) fail();
  const verified = Object.freeze({ claims });
  VERIFIED_HANDOFFS.add(verified);
  return verified;
}

export function isVerifiedBookingHandoff(value: unknown): value is VerifiedBookingHandoff {
  return typeof value === "object" && value !== null && VERIFIED_HANDOFFS.has(value);
}

export function createHmacVerifier(secret: Uint8Array): HandoffProofVerifier {
  return { verify: (envelope, canonicalPayload) => {
    const actual = Buffer.from(envelope.signature, "base64url");
    const expected = createHmac("sha256", secret).update(canonicalPayload).digest();
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } };
}
