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

import { runMcpEffect } from "./server";

import { ALL_TOOLS } from "./registry";
import { McpServices } from "../../application/mcp/service";

const TOOLS = ALL_TOOLS;

import {
  systemArchitectureResource,
  getSystemArchitecture,
} from "./resources/system/system-architecture";
import {
  strategySchemaResource,
  getStrategySchema,
} from "./resources/system/system-strategy-schema";
import { getSessionContext } from "./resources/session/session-context";
import { getRunSummaryResource } from "./resources/backtest/run-summary";
import { getStrategyHistory } from "./resources/strategy/strategy-history";
import { PROMPTS } from "./prompts/index";
import { MCP_AGENT_INSTRUCTION_MODULES, MCP_AGENT_SYSTEM_PROMPT } from "./harness-guidance";
import { Effect } from "effect";
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

      // Start interaction tracking via Effect
      await runMcpEffect(
        Effect.gen(function* () {
          const mcp = yield* McpServices;
          yield* mcp.trackInteraction({
            id: interactionId,
            session_id: sessionId,
            interaction_type: "tool_call",
            name: toolName,
            input_payload: args,
          });
        })
      ).catch((err) => console.warn("Failed to start MCP interaction tracking:", err));

      try {
        // Inject tracing metadata into tool arguments
        const enrichedArgs = {
          ...validatedInput.value,
          _interactionId: interactionId,
          _sessionId: sessionId,
        };

        const resultEffect = tool.execute(enrichedArgs as never) as Effect.Effect<unknown, unknown>;
        const result = await runMcpEffect(resultEffect);

        // Update interaction status
        await runMcpEffect(
          Effect.gen(function* () {
            const mcp = yield* McpServices;
            yield* mcp.updateStatus(interactionId, "completed", result);
          })
        ).catch((err) => console.warn("Failed to record MCP interaction completion:", err));

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
        await runMcpEffect(
          Effect.gen(function* () {
            const mcp = yield* McpServices;
            yield* mcp.updateStatus(interactionId, "error", {
              error: errorMessage,
            });
          })
        ).catch((err) => console.warn("Failed to record MCP interaction failure:", err));

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
        result = await runMcpEffect(getSystemArchitecture());
      } else if (uri === "system://strategy-schema") {
        result = await runMcpEffect(getStrategySchema());
      } else if (uri.startsWith("session://") && uri.endsWith("/context")) {
        const sessionId = uri.split("/")[2];
        result = await runMcpEffect(getSessionContext(sessionId));
      } else if (uri.startsWith("backtest://") && uri.endsWith("/summary")) {
        const runId = uri.split("/")[2];
        result = await runMcpEffect(getRunSummaryResource(runId));
      } else if (uri.startsWith("strategy://") && uri.endsWith("/history")) {
        const strategyId = uri.split("/")[2];
        result = await runMcpEffect(getStrategyHistory(strategyId));
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
