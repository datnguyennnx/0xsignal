import { Context } from "effect";
import type { McpInteraction as MCPInteraction } from "../../schemas/mcp";

export interface MCPRepository {
  readonly insertInteraction: (interaction: MCPInteraction) => Promise<MCPInteraction>;
  readonly getInteraction: (id: string) => Promise<MCPInteraction | null>;
  readonly getInteractionsBySession: (sessionId: string) => Promise<MCPInteraction[]>;
  readonly getInteractionsByCorrelation: (correlationId: string) => Promise<MCPInteraction[]>;
  readonly updateInteractionStatus: (
    id: string,
    status: string,
    outputPayload?: string | unknown
  ) => Promise<MCPInteraction | null>;
}

export const MCPRepository = Context.GenericTag<MCPRepository>("@services/MCPRepository");
