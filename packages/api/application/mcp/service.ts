import { Effect, Context, Layer } from "effect";
import { validationError, DomainError } from "../errors";
import { MCPRepository } from "../ports/mcp-repository";
import type { McpInteraction } from "../../schemas/mcp";

export class McpServices extends Context.Tag("McpServices")<
  McpServices,
  {
    readonly trackInteraction: (input: {
      id: string;
      session_id?: string;
      interaction_type: "tool_call" | "resource_access" | "prompt" | "message";
      name: string;
      input_payload?: any;
    }) => Effect.Effect<McpInteraction, DomainError>;

    readonly updateStatus: (
      id: string,
      status: "completed" | "error" | "running",
      output_payload?: any
    ) => Effect.Effect<McpInteraction | null, DomainError>;
  }
>() {}

export const McpServicesLive = Layer.effect(
  McpServices,
  Effect.gen(function* () {
    const repo = yield* MCPRepository;

    return McpServices.of({
      trackInteraction: (input) =>
        Effect.tryPromise({
          try: () =>
            repo.insertInteraction({
              ...input,
              status: "pending",
              created_at: new Date().toISOString(),
            }),
          catch: (e) => validationError("Failed to track MCP interaction", e),
        }),

      updateStatus: (id, status, output) =>
        Effect.tryPromise({
          try: () => repo.updateInteractionStatus(id, status, output),
          catch: (e) => validationError("Failed to update MCP interaction status", e),
        }),
    });
  })
);
