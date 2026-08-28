import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { TmsConfigurationError, TmsValidationError } from "../../src/tms/errors";
import { assertTmsCommandAllowed, TMS_EXECUTION_SCOPES } from "../../src/tms/policy";
import { createServerRealBookingCapability, REAL_AUTHORITY_KINDS } from "../../src/tms/real/capability";
import {
  canonicalizeHandoffPayload, createHmacVerifier, createHandoffProofAuthority, HANDOFF_PROOF_ALGORITHMS, HANDOFF_PROOF_KINDS,
  HANDOFF_PROOF_VERSIONS, verifyBookingHandoff, type HandoffNonceStore, type HandoffProofEnvelope,
} from "../../src/tms/real/proof";
import { testConfig } from "./test-helpers";

const claims = { loadId: "LOAD-1", runId: "RUN-1", sessionId: "SESSION-1", mcNumber: "MC-1", agreedRate: 2200 } as const;
const secret = new TextEncoder().encode("test-only-secret");

function envelope(overrides: Partial<HandoffProofEnvelope> = {}): HandoffProofEnvelope {
  const unsigned = {
    version: HANDOFF_PROOF_VERSIONS.V1, kind: HANDOFF_PROOF_KINDS.BOOKING,
    algorithm: HANDOFF_PROOF_ALGORITHMS.HMAC_SHA256, issuer: "booking-service", keyId: "key-1",
    issuedAt: 1_000, expiresAt: 2_000, nonce: "nonce-1", claims, signature: "",
  } satisfies HandoffProofEnvelope;
  const signature = createHmac("sha256", secret).update(canonicalizeHandoffPayload(unsigned)).digest("base64url");
  return { ...unsigned, signature, ...overrides };
}

function authority(nonces: HandoffNonceStore = { claim: () => true }) {
  return createHandoffProofAuthority({ issuer: "booking-service", keyId: "key-1", verifier: createHmacVerifier(secret), nonces });
}

describe("booking trust boundary", () => {
  it("blocks real booking at the central policy boundary", () => {
    expect(() => assertTmsCommandAllowed(testConfig({ mode: "real" }), "LOAD_BOOK", { scope: TMS_EXECUTION_SCOPES.REAL_2C_CONTROLLED_BOOKING })).toThrow(TmsConfigurationError);
  });

  it("fails closed without server authority and rejects non-production authority", async () => {
    await expect(verifyBookingHandoff({ envelope: envelope(), expected: claims })).rejects.toThrow(TmsValidationError);
    expect(() => createServerRealBookingCapability(testConfig({ mode: "real" }), {
      kind: "production", issuer: "", keyId: "key", approve: () => true,
    })).toThrow(/authority is unavailable/i);
    expect(REAL_AUTHORITY_KINDS.PRODUCTION).toBe("production");
  });

  it.each([
    ["signature", { signature: "bad" }],
    ["issuer", { issuer: "other" }],
    ["expiry", { expiresAt: 999 }],
    ["binding", { claims: { ...claims, mcNumber: "MC-2" } }],
  ])("rejects invalid %s proof", async (_name, change) => {
    await expect(verifyBookingHandoff({ envelope: envelope(change), expected: claims, authority: authority(), now: 1_500 })).rejects.toThrow(TmsValidationError);
  });

  it("rejects replay and does not activate with a test nonce provider", async () => {
    const nonces = new Set<string>();
    const store: HandoffNonceStore = { claim: (nonce) => !nonces.has(nonce) && (nonces.add(nonce), true) };
    const input = { envelope: envelope(), expected: claims, authority: authority(store), now: 1_500 };
    await expect(verifyBookingHandoff(input)).resolves.toMatchObject({ claims });
    await expect(verifyBookingHandoff(input)).rejects.toThrow(TmsValidationError);
  });
});
