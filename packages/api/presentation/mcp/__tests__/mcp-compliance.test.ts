import { it, expect, describe, vi, beforeEach, afterEach } from "vitest";
import { Effect } from "effect";
import { initializeMcpServer } from "../server";
import { McpServer } from "../index";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { McpServerDependencies } from "../server";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { Context } from "effect";
import { StrategyServices } from "@application/strategy";
import { BacktestServices } from "@application/backtest";
import { MarketDataServices } from "@application/market-data";
import { ResearchServicesTag } from "@application/research";

describe("MCP E2E Compliance Smoke Test", () => {
  const readTextBlock = (content: unknown): string => {
    if (typeof content === "object" && content !== null && "text" in content) {
      const maybeText = (content as { text?: unknown }).text;
      if (typeof maybeText === "string") {
        return maybeText;
      }
    }

    return "";
  };

  const readTextContent = (entry: unknown): string => {
    if (typeof entry === "object" && entry !== null && "text" in entry) {
      const maybeText = (entry as { text?: unknown }).text;
      if (typeof maybeText === "string") {
        return maybeText;
      }
    }

    if (typeof entry === "object" && entry !== null && "content" in entry) {
      return readTextBlock((entry as { content?: unknown }).content);
    }

    return "";
  };

  const mockMcpRepo = {
    insertInteraction: vi.fn().mockResolvedValue({}),
    updateInteractionStatus: vi.fn().mockResolvedValue({}),
    getInteraction: vi.fn(),
    getInteractionsBySession: vi.fn(),
    getInteractionsByCorrelation: vi.fn(),
  };

  const mockAgentServices = {
    openSession: vi
      .fn()
      .mockReturnValue(Effect.succeed({ id: "test-session-id", status: "pending" })),
    getSession: vi.fn().mockReturnValue(
      Effect.succeed({
        id: "test-session-id",
        source: "test",
        objective: "test objective",
        status: "pending",
        context_scope: null,
        actor_kind: null,
        actor_name: null,
        started_at: "2026-04-13T00:00:00.000Z",
        ended_at: null,
      })
    ),
    savePlan: vi.fn(),
    recordAction: vi.fn(),
  };

  const mockDeps: McpServerDependencies = {
    agentServices: mockAgentServices,
    strategyServices: {} as Context.Tag.Service<typeof StrategyServices>,
    backtestServices: {} as Context.Tag.Service<typeof BacktestServices>,
    researchServices: {} as Context.Tag.Service<typeof ResearchServicesTag>,
    marketDataServices: {} as Context.Tag.Service<typeof MarketDataServices>,
    mcpRepository: mockMcpRepo,
  };

  let server: McpServer;
  let client: Client;
  let serverTransport: InMemoryTransport;
  let clientTransport: InMemoryTransport;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockAgentServices.openSession.mockReturnValue(
      Effect.succeed({ id: "test-session-id", status: "pending" })
    );
    initializeMcpServer();

    const [t1, t2] = InMemoryTransport.createLinkedPair();
    serverTransport = t1;
    clientTransport = t2;

    server = new McpServer(mockDeps);
    client = new Client({ name: "test-client", version: "1.0.0" }, { capabilities: {} });

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  });

  afterEach(async () => {
    await Promise.all([client.close(), server.close()]);
  });

  describe("Protocol Compliance", () => {
    it("should advertise prompt and resource capabilities", async () => {
      const tools = await client.listTools();
      const prompts = await client.listPrompts();
      const resources = await client.listResources();
      const templates = await client.listResourceTemplates();

      expect(tools.tools).toBeDefined();
      expect(prompts.prompts).toBeDefined();
      expect(resources.resources).toBeDefined();
      expect(templates.resourceTemplates).toBeDefined();
    });

    it("should list tools correctly", async () => {
      const result = await client.listTools();
      expect(result.tools).toBeDefined();
      expect(result.tools.some((t: Tool) => t.name === "open_session")).toBe(true);
    });

    it("should list prompts correctly", async () => {
      const result = await client.listPrompts();
      expect(result.prompts).toBeDefined();
      expect(result.prompts.length).toBeGreaterThan(0);
      expect(result.prompts.some((p) => p.name === "session_kickoff")).toBe(true);
      expect(result.prompts.some((p) => p.name === "prepare_backtest_data")).toBe(true);
    });

    it("should resolve prompt correctly", async () => {
      const result = await client.getPrompt({
        name: "session_kickoff",
        arguments: { source: "cli", objective: "test" },
      });
      const combinedText = result.messages
        .map((m) => readTextBlock(m.content))
        .filter(Boolean)
        .join("\n");
      expect(combinedText).toContain("Source: cli");
      expect(combinedText).toContain("Objective: test");
    });

    it("should validate required prompt arguments", async () => {
      const result = await client.getPrompt({
        name: "session_kickoff",
        arguments: { source: "cli" },
      });

      const combinedText = result.messages
        .map((m) => readTextBlock(m.content))
        .filter(Boolean)
        .join("\n");
      expect(combinedText).toContain("Missing required prompt arguments");
      expect(combinedText).toContain("objective");
    });

    it("should list resources correctly", async () => {
      const result = await client.listResources();
      expect(result.resources).toBeDefined();
      expect(result.resources.some((r) => r.uri === "system://architecture")).toBe(true);
      expect(result.resources.some((r) => r.uri === "system://strategy-schema")).toBe(true);
    });

    it("should list resource templates correctly", async () => {
      const result = await client.listResourceTemplates();
      expect(result.resourceTemplates).toBeDefined();
      expect(
        result.resourceTemplates.some((t) => t.uriTemplate === "session://{sessionId}/context")
      ).toBe(true);
      expect(
        result.resourceTemplates.some((t) => t.uriTemplate === "backtest://{runId}/summary")
      ).toBe(true);
      expect(
        result.resourceTemplates.some((t) => t.uriTemplate === "strategy://{strategyId}/history")
      ).toBe(true);
    });

    it("should read resource correctly", async () => {
      const result = await client.readResource({ uri: "system://architecture" });
      expect(result.contents).toBeDefined();
      expect(result.contents[0].uri).toBe("system://architecture");
      expect(JSON.parse(readTextContent(result.contents[0]))).toHaveProperty(
        "server_name",
        "0xsignal"
      );
    });

    it("should read strategy schema resource correctly", async () => {
      const result = await client.readResource({ uri: "system://strategy-schema" });
      expect(result.contents).toBeDefined();
      expect(result.contents[0].uri).toBe("system://strategy-schema");
      const parsed = JSON.parse(readTextContent(result.contents[0]));
      expect(parsed).toHaveProperty("definitions.strategy_definition");
      expect(parsed).toHaveProperty("definitions.strategy_version");
    });

    it("should read a domain resource from template URI", async () => {
      const result = await client.readResource({ uri: "session://test-session-id/context" });
      expect(result.contents).toBeDefined();
      expect(result.contents[0].uri).toBe("session://test-session-id/context");
      const parsed = JSON.parse(readTextContent(result.contents[0]));
      expect(parsed).toHaveProperty("id", "test-session-id");
      expect(parsed).toHaveProperty("objective", "test objective");
    });
  });

  describe("Success Execution & Tracking", () => {
    it("should call tool and track interaction", async () => {
      const result = await client.callTool({
        name: "open_session",
        arguments: { source: "test", objective: "test" },
      });

      const parsed = JSON.parse(readTextContent(result.content[0]));
      expect(parsed).toEqual({
        session_id: "test-session-id",
        status: "pending",
      });

      // Verify interaction tracking
      expect(mockMcpRepo.insertInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "open_session",
          interaction_type: "tool_call",
          status: "running",
        })
      );

      expect(mockMcpRepo.updateInteractionStatus).toHaveBeenCalledWith(
        expect.any(String),
        "completed",
        expect.anything()
      );
    });
  });

  describe("Failure Path & Tracking", () => {
    it("should surface error and track failure", async () => {
      mockAgentServices.openSession.mockReturnValue(Effect.fail(new Error("Simulated failure")));

      const result = await client.callTool({
        name: "open_session",
        arguments: { source: "test", objective: "test" },
      });

      expect(result.isError).toBe(true);
      expect(readTextContent(result.content[0])).toContain("Simulated failure");

      // Verify interaction tracking recorded the failure
      expect(mockMcpRepo.updateInteractionStatus).toHaveBeenCalledWith(
        expect.any(String),
        "failed",
        expect.objectContaining({ error: "Simulated failure" })
      );
    });

    it("should still return success when completion tracking fails", async () => {
      mockMcpRepo.updateInteractionStatus.mockRejectedValueOnce(new Error("completed-update-fail"));

      const result = await client.callTool({
        name: "open_session",
        arguments: { source: "test", objective: "tracking-failure" },
      });

      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(readTextContent(result.content[0]));
      expect(parsed).toEqual({
        session_id: "test-session-id",
        status: "pending",
      });
    });

    it("should still return tool error when failure tracking fails", async () => {
      mockAgentServices.openSession.mockReturnValue(Effect.fail(new Error("Simulated failure")));
      mockMcpRepo.updateInteractionStatus.mockRejectedValueOnce(new Error("failed-update-fail"));

      const result = await client.callTool({
        name: "open_session",
        arguments: { source: "test", objective: "tracking-failure" },
      });

      expect(result.isError).toBe(true);
      expect(readTextContent(result.content[0])).toContain("Simulated failure");
    });
  });
});
