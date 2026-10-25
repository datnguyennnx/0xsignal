/**
 * Import-graph guard for the target (module-first) architecture.
 *
 * Rules for directories that do not exist yet are intentional: they are
 * vacuously satisfied today and start biting the moment a module moves in.
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
        "A cycle makes the layer direction meaningless. TODO: warn-only until the " +
        "two known type-only cycles are broken (extract the repo ports out of the " +
        "facade files): " +
        "auth/.../exchange-account.repo.pg.ts:5 -> exchange-account.repo.ts:5 and " +
        "auth/.../exchange-credential.repo.pg.ts:4 -> exchange-credential.repo.ts:20. " +
        "Both reverse edges are `import type` of the port interface only.",
      severity: "warn",
      from: {},
      to: { circular: true },
    },
    {
      name: "domain-is-pure",
      comment: "Domain may depend on itself, @0xsignal/shared and effect. Nothing else.",
      severity: "error",
      from: { path: "^packages/api/domain/" },
      to: { path: "^packages/(?!(api/domain|shared)/)" },
    },
    {
      name: "application-no-infrastructure",
      comment:
        "Application talks to ports; infrastructure, presentation and integrations implement them.",
      severity: "error",
      from: { path: "^packages/api/application/" },
      to: { path: "^packages/api/(infrastructure|presentation|integrations)/" },
    },
    {
      name: "infrastructure-no-presentation",
      comment: "Infrastructure must not reach up into presentation.",
      severity: "error",
      from: { path: "^packages/api/infrastructure/" },
      to: { path: "^packages/api/presentation/" },
    },
    {
      name: "shared-workspace-downward",
      comment: "Shared is the bottom of the workspace graph.",
      severity: "error",
      from: { path: "^packages/shared/" },
      to: { path: "^packages/(api|auth|app)/" },
    },
    {
      name: "logic-is-pure",
      comment:
        "logic.ts is pure decision code: no Effect runtime, no platform, no " +
        "integrations, no app wiring and no other module's internals.",
      severity: "error",
      from: { path: "^packages/api/.*logic\\.ts$" },
      to: {
        path: [
          "^packages/api/(platform|integrations|app)/",
          "^node_modules/(effect|@effect|bun)/",
          "^node:",
        ],
      },
    },
    {
      name: "logic-no-other-module",
      comment: "A module's logic.ts may only import from its own module.",
      severity: "error",
      from: { path: "^packages/api/modules/([^/]+)/.*logic\\.ts$" },
      to: {
        path: "^packages/api/modules/",
        pathNot: "^packages/api/modules/$1/",
      },
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
