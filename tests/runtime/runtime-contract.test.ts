import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("repository runtime contract", () => {
  it("keeps a local build/start contract and excludes real runners from the default suite", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };
    expect(packageJson.scripts.build).toBe("next build");
    expect(packageJson.scripts.start).toBe("next start --hostname 0.0.0.0");
    expect(packageJson.scripts.test).toBe("vitest run");
    expect(packageJson.scripts["test:real-tms:booking"]).toContain("vitest run");
    expect(readFileSync("vitest.config.ts", "utf8")).toContain('exclude: ["tests/tms/real/**"]');
  });

  it("keeps health independent from TMS and booking dependencies", () => {
    const route = readFileSync("app/api/health/route.ts", "utf8");
    expect(route).not.toMatch(/process\.env|TmsClient|connectTcp|LOAD_BOOK|bookLoad|fetch\(|net\./);
  });
});
