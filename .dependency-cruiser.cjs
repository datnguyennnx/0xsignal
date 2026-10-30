/**
 * Import-graph guard for the module-first api plus workspace direction.
 *
 * packages/api is modules/<name>/ (public surface = index.ts) over shared
 * platform/ and integrations/ plumbing. packages/auth splits into
 * domain/application/infrastructure/presentation and is covered here only by
 * the workspace-direction rule, not by layer rules.
 *
 * NOT covered here, because neither is an import-graph property (review only):
 *   - `Layer.provide` may only appear in `app.layer.ts`
 *   - no in-place mutation of a `Ref` value
 */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      comment:
        "A cycle makes the layer direction meaningless. Warn-only by design: both " +
        "cycles below are type-only back-edges (each *.repo.pg.ts imports just " +
        "types from its *.repo.ts port file), so they cannot invert a runtime layer.",
      severity: "warn",
      from: {},
      to: { circular: true },
    },
    {
      name: "shared-workspace-downward",
      comment: "Shared is the bottom of the workspace graph.",
      severity: "error",
      from: { path: "^packages/shared/" },
      to: { path: "^packages/(api|auth|app)/" },
    },
    {
      name: "integrations-no-modules",
      comment:
        "Integrations are adapters; composition of modules happens above them. " +
        "They may import a module's public surface (index.ts) because depending " +
        "on a published port is inversion, not internal coupling.",
      severity: "error",
      from: { path: "^packages/api/integrations/" },
      to: {
        path: "^packages/api/modules/",
        pathNot: "^packages/api/modules/[^/]+/index\\.ts$",
      },
    },
    {
      name: "platform-no-modules",
      comment: "Platform is cross-cutting plumbing, not module coupling.",
      severity: "error",
      from: { path: "^packages/api/platform/" },
      to: { path: "^packages/api/modules/" },
    },
    {
      name: "modules-no-cross-module-internals",
      comment: "Modules expose themselves only through their index.ts barrel.",
      severity: "error",
      from: { path: "^packages/api/modules/([^/]+)/" },
      to: {
        path: "^packages/api/modules/",
        pathNot: ["^packages/api/modules/$1/", "index\\.ts$"],
      },
    },
  ],
  options: {
    enhancedResolveOptions: {
      // TypeScript 7 (tsgo) is newer than dependency-cruiser's transpiler
      // bridge, so resolution extensions are declared here instead.
      extensions: [".ts", ".tsx", ".d.ts", ".js", ".mjs", ".cjs", ".json"],
    },
    doNotFollow: { path: "node_modules" },
    // Tests deliberately reach across boundaries (a parser test imports the
    // adapter it exercises) and are excluded from the build tsconfig too.
    exclude: {
      path: ["(^|/)node_modules/", "(^|/)dist/", "(^|/)__tests__/", "\\.test\\.ts$", "\\.d\\.ts$"],
    },
    tsPreCompilationDeps: true,
    combinedDependencies: true,
  },
};
