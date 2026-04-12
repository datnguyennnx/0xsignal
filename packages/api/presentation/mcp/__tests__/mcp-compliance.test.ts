import { it, expect, describe, vi, beforeEach, afterEach } from "vitest";
import { Effect } from "effect";
import { initializeMcpServer } from "../server";
import { McpServer } from "../index";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { McpServerDependencies } from "../server";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

describe("MCP E2E Compliance Smoke Test", () => {
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
    getSession: vi.fn(),
    savePlan: vi.fn(),
    recordAction: vi.fn(),
  };

  const mockDeps: McpServerDependencies = {
    agentServices: mockAgentServices,
    strategyServices: {} as any,
    backtestServices: {} as any,
    researchServices: {} as any,
    marketDataServices: {} as any,
    mcpRepository: mockMcpRepo as any,
  };

  let server: McpServer;
  let client: Client;
  let serverTransport: InMemoryTransport;
  let clientTransport: InMemoryTransport;

  beforeEach(async () => {
    vi.clearAllMocks();
    initializeMcpServer({}, mockDeps);

    const [t1, t2] = InMemoryTransport.createLinkedPair();
    serverTransport = t1;
    clientTransport = t2;

    server = new McpServer();
    client = new Client({ name: "test-client", version: "1.0.0" }, { capabilities: {} });

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  });

  afterEach(async () => {
    await Promise.all([client.close(), server.close()]);
  });

  describe("Protocol Compliance", () => {
    it("should list tools correctly", async () => {
      const result = await client.listTools();
      expect(result.tools).toBeDefined();
      expect(result.tools.some((t: Tool) => t.name === "open_session")).toBe(true);
    });

    it("should list prompts correctly", async () => {
      const result = await client.listPrompts();
      expect(result.prompts).toBeDefined();
      expect(result.prompts.length).toBeGreaterThan(0);
    });

    it("should resolve prompt correctly", async () => {
      const result = await client.getPrompt({
        name: "design_strategy",
        arguments: { market_type: "crypto", objective: "test" },
      });
      expect((result.messages[0].content as any).text).toContain("Market Type: crypto");
      expect((result.messages[0].content as any).text).toContain("Objective: test");
    });

    it("should list resources correctly", async () => {
      const result = await client.listResources();
      expect(result.resources).toBeDefined();
      expect(result.resources.some((r: any) => r.uri === "system://architecture")).toBe(true);
    });

    it("should read resource correctly", async () => {
      const result = await client.readResource({ uri: "system://architecture" });
      expect(result.contents).toBeDefined();
      expect(result.contents[0].uri).toBe("system://architecture");
      expect(JSON.parse((result.contents[0] as any).text)).toHaveProperty(
        "server_name",
        "0xsignal"
      );
    });
  });

  describe("Success Execution & Tracking", () => {
    it("should call tool and track interaction", async () => {
      const result = await client.callTool({
        name: "open_session",
        arguments: { source: "test", objective: "test" },
      });

      const parsed = JSON.parse((result as any).content[0].text);
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
      expect((result as any).content[0].text).toContain("Simulated failure");

      // Verify interaction tracking recorded the failure
      expect(mockMcpRepo.updateInteractionStatus).toHaveBeenCalledWith(
        expect.any(String),
        "failed",
        expect.objectContaining({ error: "Simulated failure" })
      );
    });
  });
});
