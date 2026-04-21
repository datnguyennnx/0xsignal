import { defineConfig } from "vitest/config";

const integrationSuites = [
  "infrastructure/db/__tests__/backtest.reproducibility.test.ts",
  "infrastructure/db/__tests__/failure-path.test.ts",
  "infrastructure/db/__tests__/integrity-invariants.test.ts",
  "infrastructure/db/__tests__/migration.smoke.test.ts",
  "infrastructure/db/postgres/repositories/__tests__/agent.repository.test.ts",
  "infrastructure/db/__tests__/questdb.runtime.integration.test.ts",
];

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: integrationSuites,
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
