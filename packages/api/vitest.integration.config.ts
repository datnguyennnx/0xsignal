import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

const integrationSuites = [
  "application/__tests__/backtest.reproducibility.test.ts",
  "infrastructure/db/__tests__/failure-path.test.ts",
  "infrastructure/db/__tests__/integrity-invariants.test.ts",
  "infrastructure/db/__tests__/migration.smoke.test.ts",
  "infrastructure/repositories/__tests__/agent-repo.test.ts",
  "infrastructure/db/__tests__/questdb.runtime.integration.test.ts",
];

export default defineConfig({
  resolve: {
    alias: {
      "@application": resolve(__dirname, "application"),
      "@infrastructure": resolve(__dirname, "infrastructure"),
      "@domain": resolve(__dirname, "domain"),
      "@presentation": resolve(__dirname, "presentation"),
      "@schemas": resolve(__dirname, "schemas"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: integrationSuites,
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
