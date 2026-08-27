import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": new URL("./", import.meta.url).pathname,
      "server-only": new URL("./tests/server-only-shim.ts", import.meta.url).pathname,
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/tms/real/**"],
    clearMocks: true,
    restoreMocks: true,
    unstubEnvs: true,
    testTimeout: 10_000,
  },
});
