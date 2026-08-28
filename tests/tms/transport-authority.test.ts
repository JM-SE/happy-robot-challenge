import { describe, expect, it, vi } from "vitest";
import tls from "node:tls";
import { getTmsConfig } from "../../src/tms/config-core";
import { TmsConfigurationError } from "../../src/tms/errors";
import { connectTls } from "../../src/tms/transport";
import { createTargetAuthority } from "../../src/tms/target-authority";

vi.mock("node:tls", () => ({ default: { connect: vi.fn() } }));

const target = createTargetAuthority({
  approvedTargets: [{ host: "tms.example.invalid", port: 443, serverName: "tms.example.invalid", ca: "CA" }],
  egressApproval: "private-network",
}).authorize({ host: "tms.example.invalid", port: 443 });

describe("real target authority and TLS transport", () => {
  it("rejects real configuration without an independent authority", () => {
    expect(() => getTmsConfig({
      NODE_ENV: "test",
      TMS_MODE: "real", TMS_ENV: "non-production", TMS_REAL_ENABLED: "true",
      TMS_HOST: "tms.example.invalid", TMS_PORT: "443", TMS_AUTH_TOKEN: "token",
      TMS_CONNECT_TIMEOUT_MS: "10", TMS_RESPONSE_TIMEOUT_MS: "10",
      TMS_REAL_TARGET_PIN: "tms.example.invalid:443",
      TMS_REAL_TARGET_ALLOWLIST: "tms.example.invalid:443",
      TMS_REAL_TRANSPORT_APPROVED: "true",
    })).toThrow("authority");
  });

  it("rejects an authority mismatch before TLS connect", () => {
    const authority = createTargetAuthority({
      approvedTargets: [{ host: "other.example.invalid", port: 443, serverName: "other.example.invalid" }],
      egressApproval: "private-network",
    });
    expect(() => authority.authorize({ host: target.host, port: target.port })).toThrow(TmsConfigurationError);
  });

  it("passes verified TLS options and never opts into plaintext", () => {
    const socket = { once: vi.fn(), on: vi.fn(), removeListener: vi.fn(), write: vi.fn(), end: vi.fn(), destroy: vi.fn() };
    const connect = vi.mocked(tls.connect).mockReturnValue(socket as never);
    connectTls(target, { handshakeTimeoutMs: 100 });
    expect(connect).toHaveBeenCalledWith(expect.objectContaining({
      host: target.host, port: target.port, servername: target.serverName,
      rejectUnauthorized: true, ca: "CA", timeout: 100,
    }));
    connect.mockReset();
  });
});
