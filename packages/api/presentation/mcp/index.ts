import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ListResourceTemplatesRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import {
  makeMcpDependencies,
  initializeMcpServer,
  getMcpDependencies,
  McpContextLayer,
} from "./server";

import { ALL_TOOLS } from "./registry";

const TOOLS = ALL_TOOLS;

import { systemArchitectureResource, getSystemArchitecture } from "./resources/system-architecture";
import { strategySchemaResource, getStrategySchema } from "./resources/system-strategy-schema";
import { getSessionContext } from "./resources/session-context";
import { getRunSummaryResource } from "./resources/run-summary";
import { getStrategyHistory } from "./resources/strategy-history";
import { PROMPTS } from "./prompts/index";
import { Effect } from "effect";
import { QuestDBClientLayer } from "../../infrastructure/db/questdb/client";
import { initializeSchema } from "../../infrastructure/db/questdb/repositories/candle";

function getResources() {
  return [systemArchitectureResource(), strategySchemaResource()];
}

// PROMPTS are imported from ./prompts/index

export class McpServer extends Server {
  constructor() {
    super(
      {
        name: "0xsignal-mcp",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
      }
    );

    this.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: TOOLS.map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
      };
    });

    this.setRequestHandler(CallToolRequestSchema, async (request) => {
      const toolName = request.params.name;
      const args = request.params.arguments ?? {};

      const tool = TOOLS.find((t) => t.name === toolName);
      if (!tool) {
        throw new Error(`Tool "${toolName}" not found`);
      }

      const deps = getMcpDependencies();
      const interactionId = crypto.randomUUID();
      const sessionId = (args as any).session_id || (args as any).sessionId;

      // Start interaction tracking
      await deps.mcpRepository.insertInteraction({
        id: interactionId,
        session_id: sessionId,
        interaction_type: "tool_call",
        name: toolName,
        input_payload: args,
        status: "running",
        created_at: new Date().toISOString(),
      });

      try {
        // Inject tracing metadata into tool arguments
        const enrichedArgs = {
          ...args,
          _interactionId: interactionId,
          _sessionId: sessionId,
        };

        const resultEffect = tool.execute(enrichedArgs as any) as any;

        // Provide the necessary central layer stack
        const providedEffect = resultEffect.pipe(Effect.provide(McpContextLayer));

        const result = await Effect.runPromise(providedEffect);

        // Update interaction status
        await deps.mcpRepository.updateInteractionStatus(interactionId, "completed", result);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Record failure
        await deps.mcpRepository.updateInteractionStatus(interactionId, "failed", {
          error: errorMessage,
        });

        return {
          content: [
            {
              type: "text",
              text: `Error: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    });

    this.setRequestHandler(ListResourcesRequestSchema, async () => {
      const resources = getResources();
      return {
        resources: resources.map((resource) => ({
          uri: resource.uri,
          name: resource.name,
          description: resource.description,
          mimeType: resource.mimeType,
        })),
      };
    });

    this.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
      return {
        resourceTemplates: [
          {
            uriTemplate: "session://{sessionId}/context",
            name: "Session Context",
            description: "Context details for a session",
            mimeType: "application/json",
          },
          {
            uriTemplate: "backtest://{runId}/summary",
            name: "Run Summary",
            description: "Metrics and events for a backtest run",
            mimeType: "application/json",
          },
          {
            uriTemplate: "strategy://{strategyId}/history",
            name: "Strategy History",
            description: "Version chain for a strategy",
            mimeType: "application/json",
          },
        ],
      };
    });

    this.setRequestHandler(ListPromptsRequestSchema, async () => {
      return {
        prompts: PROMPTS || [],
      };
    });

    this.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const promptName = request.params.name;
      const args = request.params.arguments || {};

      const prompt = (PROMPTS as any[]).find((p) => p.name === promptName);
      if (!prompt) {
        throw new Error(`Prompt "${promptName}" not found`);
      }

      // Simple template resolution
      let text = (prompt as any).template || "";
      for (const [key, value] of Object.entries(args)) {
        text = text.replace(`{{${key}}}`, String(value));
      }

      return {
        description: prompt.description,
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: text,
            },
          },
        ],
      };
    });

    this.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const uri = request.params.uri;

      let result: any;
      if (uri === "system://architecture") {
        result = await Effect.runPromise(getSystemArchitecture());
      } else if (uri === "system://strategy-schema") {
        result = await Effect.runPromise(getStrategySchema());
      } else if (uri.startsWith("session://") && uri.endsWith("/context")) {
        const sessionId = uri.split("/")[2];
        result = await Effect.runPromise(getSessionContext(sessionId));
      } else if (uri.startsWith("backtest://") && uri.endsWith("/summary")) {
        const runId = uri.split("/")[2];
        result = await Effect.runPromise(getRunSummaryResource(runId));
      } else if (uri.startsWith("strategy://") && uri.endsWith("/history")) {
        const strategyId = uri.split("/")[2];
        result = await Effect.runPromise(getStrategyHistory(strategyId));
      }

      if (!result) {
        throw new Error(`Resource "${uri}" not found`);
      }

      return {
        contents: [
          {
            uri: result.resource.uri,
            mimeType: result.resource.mimeType,
            text: result.content,
          },
        ],
      };
    });
  }
}

export async function main() {
  // Initialize server with default dependencies
  const deps = await makeMcpDependencies();
  initializeMcpServer({}, deps);

  // Bootstrap QuestDB schema silently
  try {
    await Effect.runPromise(initializeSchema().pipe(Effect.provide(QuestDBClientLayer)));
  } catch (error) {
    // Fail silently in main but error will be known on first query if it persists
  }

  const transport = new StdioServerTransport();
  const server = new McpServer();

  await server.connect(transport);
}

if (import.meta.main) {
  main().catch((error) => {
    console.error("MCP server error:", error);
    process.exit(1);
  });
}
