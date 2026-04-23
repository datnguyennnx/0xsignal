import { Effect, ManagedRuntime } from "effect";
import { AppLayer } from "../../infrastructure/layers/app.layer";

/**
 * MCP Runtime - bridge between Effect-TS application services and MCP protocol handlers.
 * Standardizes on AppLayer for all capability resolution.
 */
export const McpRuntime = ManagedRuntime.make(AppLayer);

export const runMcpEffect = <A, E>(effect: Effect.Effect<A, E, any>) =>
  McpRuntime.runPromise(effect);
