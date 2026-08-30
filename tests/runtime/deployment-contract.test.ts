import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("Railway-ready repository deployment contract", () => {
  it("uses a production Docker image with dynamic PORT and direct SIGTERM delivery", () => {
    const dockerfile = read("Dockerfile");

    expect(dockerfile).toContain("FROM node:22-alpine AS dependencies");
    expect(dockerfile).toContain("FROM node:22-alpine AS builder");
    expect(dockerfile).toContain("FROM node:22-alpine AS runner");
    expect(dockerfile).toContain("RUN npm ci");
    expect(dockerfile).toContain("RUN npm run build");
    expect(dockerfile).toContain("RUN npm ci --omit=dev");
    expect(dockerfile).toContain("ENV NODE_ENV=production");
    expect(dockerfile).toContain("ENV HOSTNAME=0.0.0.0");
    expect(dockerfile).toContain("ENV PORT=3000");
    expect(dockerfile).toContain("STOPSIGNAL SIGTERM");
    expect(dockerfile).toContain('CMD ["node", "node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0"]');
    expect(dockerfile).not.toMatch(/TMS_AUTH_TOKEN|ADAPTER_SHARED_SECRET|LOAD_BOOK/);
  });

  it("keeps deployment context free of local secrets and generated artifacts", () => {
    const dockerignore = read(".dockerignore");

    expect(dockerignore).toContain(".env*");
    expect(dockerignore).toContain("!.env.example");
    expect(dockerignore).toContain("node_modules");
    expect(dockerignore).toContain(".next");
    expect(dockerignore).toContain("reports");
  });

  it("configures Railway to build the Dockerfile and use public liveness only", () => {
    const railway = JSON.parse(read("railway.json")) as {
      build: { builder: string; dockerfilePath: string };
      deploy: { healthcheckPath: string; healthcheckTimeout: number; restartPolicyType: string };
    };

    expect(railway.build).toEqual({ builder: "DOCKERFILE", dockerfilePath: "Dockerfile" });
    expect(railway.deploy.healthcheckPath).toBe("/api/health");
    expect(railway.deploy.healthcheckTimeout).toBe(10);
    expect(railway.deploy.restartPolicyType).toBe("ON_FAILURE");
  });
});
