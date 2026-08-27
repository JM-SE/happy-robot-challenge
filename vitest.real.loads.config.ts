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
    include: ["tests/tms/real/loads.test.ts"],
    clearMocks: true,
    restoreMocks: true,
    unstubEnvs: true,
    testTimeout: 15_000,
  },
});
