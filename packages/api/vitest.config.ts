import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/__tests__/**/*.test.ts", "**/*.test.ts"],
    exclude: [
      "node_modules",
      "dist",
      "infrastructure/db/__tests__/backtest.reproducibility.test.ts",
      "infrastructure/db/__tests__/failure-path.test.ts",
      "infrastructure/db/__tests__/integrity-invariants.test.ts",
      "infrastructure/db/__tests__/migration.smoke.test.ts",
      "infrastructure/db/postgres/repositories/__tests__/agent.repository.test.ts",
      "infrastructure/db/__tests__/questdb.runtime.integration.test.ts",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["infrastructure/**/*.ts", "presentation/**/*.ts"],
      exclude: ["**/*.test.ts", "**/index.ts"],
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
