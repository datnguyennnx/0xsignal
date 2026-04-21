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

import { makeMcpDependencies, makeMcpRequestLayer } from "./server";

import { ALL_TOOLS } from "./registry";

const TOOLS = ALL_TOOLS;

import {
  systemArchitectureResource,
  getSystemArchitecture,
  strategySchemaResource,
  getStrategySchema,
  getSessionContext,
  getRunSummaryResource,
  getStrategyHistory,
} from "./resources";
import { PROMPTS } from "./prompts/index";
import { MCP_AGENT_INSTRUCTION_MODULES, MCP_AGENT_SYSTEM_PROMPT } from "./harness-guidance";
import { Effect } from "effect";
import { QuestDBClientLayer } from "@infrastructure/db/questdb/client";
import { initializeSchema } from "@infrastructure/db/questdb/repositories/candle";
import type { McpServerDependencies } from "./server";
import { formatToolErrorMessage, validateToolArguments } from "./tool-argument-validation";
import type { JsonSchema } from "./tool-argument-validation";

type PromptArgument = {
  readonly name: string;
  readonly required?: boolean;
};

type PromptDefinition = {
  readonly name: string;
  readonly description: string;
  readonly template: string;
  readonly arguments?: readonly PromptArgument[];
};

type ResourceReadResult = {
  readonly resource: {
    readonly uri: string;
    readonly mimeType: string;
  };
  readonly content: string;
};

function getResources() {
  return [systemArchitectureResource(), strategySchemaResource()];
}

const RESOURCE_TEMPLATES = [
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
] as const;

// PROMPTS are imported from ./prompts/index

export class McpServer extends Server {
  private readonly deps: McpServerDependencies;
  private readonly requestLayer: ReturnType<typeof makeMcpRequestLayer>;

  constructor(deps: McpServerDependencies) {
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

    this.deps = deps;
    this.requestLayer = makeMcpRequestLayer(this.deps);

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

      const interactionId = crypto.randomUUID();
      const validatedInput = validateToolArguments(tool.inputSchema as JsonSchema, args);
      if (!validatedInput.ok) {
        return {
          content: [
            {
              type: "text",
              text: `Error: Invalid arguments for ${toolName}: ${validatedInput.message}`,
            },
          ],
          isError: true,
        };
      }

      const sessionId =
        typeof validatedInput.value.session_id === "string"
          ? validatedInput.value.session_id
          : typeof validatedInput.value.sessionId === "string"
            ? validatedInput.value.sessionId
            : undefined;

      // Start interaction tracking
      await this.deps.mcpRepository.insertInteraction({
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
          ...validatedInput.value,
          _interactionId: interactionId,
          _sessionId: sessionId,
        };

        const resultEffect = tool.execute(enrichedArgs as never) as Effect.Effect<unknown, unknown>;

        const providedEffect = resultEffect.pipe(Effect.provide(this.requestLayer));

        const result = await Effect.runPromise(providedEffect);

        // Update interaction status
        try {
          await this.deps.mcpRepository.updateInteractionStatus(interactionId, "completed", result);
        } catch (trackingError) {
          console.warn("Failed to record MCP interaction completion:", trackingError);
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        const errorMessage = formatToolErrorMessage(error);

        // Record failure
        try {
          await this.deps.mcpRepository.updateInteractionStatus(interactionId, "failed", {
            error: errorMessage,
          });
        } catch (trackingError) {
          console.warn("Failed to record MCP interaction failure:", trackingError);
        }

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
        resourceTemplates: [...RESOURCE_TEMPLATES],
      };
    });

    this.setRequestHandler(ListPromptsRequestSchema, async () => {
      return {
        prompts: (PROMPTS || []).map((prompt) => {
          const descriptionPrefix =
            prompt.name === "session_kickoff"
              ? "[canonical]"
              : prompt.name === "prepare_backtest_data"
                ? "[data-workflow]"
                : prompt.name === "analyze_backtest_run"
                  ? "[analysis-workflow]"
                  : "[workflow]";
          return {
            ...prompt,
            description: `${descriptionPrefix} ${prompt.description}`,
          };
        }),
      };
    });

    this.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const promptName = request.params.name;
      const args = request.params.arguments || {};

      const prompt = PROMPTS.find((p) => p.name === promptName) as PromptDefinition | undefined;
      if (!prompt) {
        throw new Error(`Prompt "${promptName}" not found`);
      }

      const requiredArgs: string[] = (prompt.arguments ?? [])
        .filter((arg) => arg.required)
        .map((arg) => arg.name);

      const missingRequired = requiredArgs.filter((arg) => args[arg] === undefined);
      if (missingRequired.length > 0) {
        return {
          description: prompt.description,
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `Error: Missing required prompt arguments for ${promptName}: ${missingRequired.join(", ")}.`,
              },
            },
          ],
        };
      }

      // Simple template resolution
      let text = prompt.template;
      for (const [key, value] of Object.entries(args)) {
        text = text.replaceAll(`{{${key}}}`, String(value));
      }
      text = text.replace(/\{\{[^}]+\}\}/g, "");

      const guidance = `${MCP_AGENT_SYSTEM_PROMPT}\n\nInstruction modules:\n- Prerequisite checklist: ${MCP_AGENT_INSTRUCTION_MODULES.prerequisite_checklist.join(" ")}\n- Mutation verification: ${MCP_AGENT_INSTRUCTION_MODULES.mutation_verification.join(" ")}\n- Anti-confusion rules: ${MCP_AGENT_INSTRUCTION_MODULES.anti_confusion_rules.join(" ")}`;

      return {
        description: prompt.description,
        messages: [
          {
            role: "assistant",
            content: {
              type: "text",
              text: guidance,
            },
          },
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
      let result: ResourceReadResult | undefined;
      if (uri === "system://architecture") {
        result = await Effect.runPromise(
          getSystemArchitecture().pipe(Effect.provide(this.requestLayer))
        );
      } else if (uri === "system://strategy-schema") {
        result = await Effect.runPromise(
          getStrategySchema().pipe(Effect.provide(this.requestLayer))
        );
      } else if (uri.startsWith("session://") && uri.endsWith("/context")) {
        const sessionId = uri.split("/")[2];
        result = await Effect.runPromise(
          getSessionContext(sessionId).pipe(Effect.provide(this.requestLayer))
        );
      } else if (uri.startsWith("backtest://") && uri.endsWith("/summary")) {
        const runId = uri.split("/")[2];
        result = await Effect.runPromise(
          getRunSummaryResource(runId).pipe(Effect.provide(this.requestLayer))
        );
      } else if (uri.startsWith("strategy://") && uri.endsWith("/history")) {
        const strategyId = uri.split("/")[2];
        result = await Effect.runPromise(
          getStrategyHistory(strategyId).pipe(Effect.provide(this.requestLayer))
        );
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

  // Bootstrap QuestDB schema silently
  try {
    await Effect.runPromise(initializeSchema().pipe(Effect.provide(QuestDBClientLayer)));
  } catch {
    // Fail silently in main but error will be known on first query if it persists
  }

  const transport = new StdioServerTransport();
  const server = new McpServer(deps);

  await server.connect(transport);
}

if (import.meta.main) {
  main().catch((error) => {
    console.error("MCP server error:", error);
    process.exit(1);
  });
}
