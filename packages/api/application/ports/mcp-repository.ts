import { Context, Effect } from "effect";
import type { McpInteraction as MCPInteraction } from "../../schemas/mcp";
import { DomainError } from "../errors";

export interface MCPRepository {
  readonly insertInteraction: (
    interaction: MCPInteraction
  ) => Effect.Effect<MCPInteraction, DomainError>;
  readonly getInteraction: (id: string) => Effect.Effect<MCPInteraction | null, DomainError>;
  readonly getInteractionsBySession: (
    sessionId: string
  ) => Effect.Effect<MCPInteraction[], DomainError>;
  readonly getInteractionsByCorrelation: (
    correlationId: string
  ) => Effect.Effect<MCPInteraction[], DomainError>;
  readonly updateInteractionStatus: (
    id: string,
    status: string,
    outputPayload?: string | unknown
  ) => Effect.Effect<MCPInteraction | null, DomainError>;
}

export const MCPRepository = Context.GenericTag<MCPRepository>("@services/MCPRepository");
