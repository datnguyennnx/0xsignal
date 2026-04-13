import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Effect } from "effect";
import { initializeMcpServer } from "../server";
import { McpServer } from "../index";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { McpServerDependencies } from "../server";

describe("MCP Tool Input Validation", () => {
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
    strategyServices: {} as never,
    backtestServices: {} as never,
    researchServices: {} as never,
    marketDataServices: {} as never,
    mcpRepository: mockMcpRepo as never,
  };

  let server: McpServer;
  let client: Client;

  beforeEach(async () => {
    vi.clearAllMocks();
    initializeMcpServer({}, mockDeps);
    const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
    server = new McpServer();
    client = new Client({ name: "test-client", version: "1.0.0" }, { capabilities: {} });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  });

  afterEach(async () => {
    await Promise.all([client.close(), server.close()]);
  });

  it("rejects invalid open_session payload before execution", async () => {
    const result = await client.callTool({
      name: "open_session",
      arguments: { source: "test" },
    });

    expect(result.isError).toBe(true);
    expect((result as any).content[0].text).toContain("Invalid arguments");
    expect((result as any).content[0].text).toContain("input.objective is required");
    expect(mockAgentServices.openSession).not.toHaveBeenCalled();
    expect(mockMcpRepo.insertInteraction).not.toHaveBeenCalled();
  });
});
