import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

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
    include: ["**/__tests__/**/*.test.ts", "**/*.test.ts"],
    exclude: ["node_modules", "dist"],
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
