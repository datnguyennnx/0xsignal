import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Effect } from "effect";
import { McpServer } from "../index";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { McpServerDependencies } from "../server";

describe("MCP Tool Input Validation", () => {
  const readTextContent = (entry: unknown): string => {
    if (typeof entry === "object" && entry !== null && "text" in entry) {
      const maybeText = (entry as { text?: unknown }).text;
      return typeof maybeText === "string" ? maybeText : "";
    }

    if (typeof entry === "object" && entry !== null && "content" in entry) {
      const content = (entry as { content?: unknown }).content;
      if (typeof content === "object" && content !== null && "text" in content) {
        const maybeText = (content as { text?: unknown }).text;
        return typeof maybeText === "string" ? maybeText : "";
      }
    }

    return "";
  };

  const firstToolContentBlock = (result: unknown): unknown => {
    if (typeof result !== "object" || result === null || !("content" in result)) {
      throw new Error("expected tool result with content");
    }
    const content = (result as { content?: unknown }).content;
    if (!Array.isArray(content) || content.length === 0) {
      throw new Error("expected tool result.content to be a non-empty array");
    }
    return content[0];
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
    getSession: vi.fn(),
    savePlan: vi.fn(),
    getPlansBySession: vi.fn(),
    recordAction: vi.fn(),
    getActionsBySession: vi.fn(),
  };

  const mockMarketDataServices = {
    inspectCoverage: vi.fn(),
    createDatasetSnapshot: vi.fn(),
    discoverMarkets: vi.fn(),
    getCandles: vi.fn(),
    requestCandlesticks: vi.fn(),
    getDatasetSnapshot: vi.fn(),
  };

  const mockDeps: McpServerDependencies = {
    agentServices: mockAgentServices,
    strategyServices: {} as never,
    backtestServices: {} as never,
    researchServices: {} as never,
    marketDataServices: mockMarketDataServices as never,
    mcpRepository: mockMcpRepo as never,
  };

  let server: McpServer;
  let client: Client;

  beforeEach(async () => {
    vi.clearAllMocks();
    const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
    server = new McpServer(mockDeps);
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
    expect(readTextContent(firstToolContentBlock(result))).toContain("Invalid arguments");
    expect(readTextContent(firstToolContentBlock(result))).toContain("input.objective is required");
    expect(mockAgentServices.openSession).not.toHaveBeenCalled();
    expect(mockMcpRepo.insertInteraction).not.toHaveBeenCalled();
  });

  it("rejects create_dataset_snapshot when required fields are missing", async () => {
    const result = await client.callTool({
      name: "create_dataset_snapshot",
      arguments: {
        request_id: "r-1",
        symbol: "BTC",
      },
    });

    expect(result.isError).toBe(true);
    expect(readTextContent(firstToolContentBlock(result))).toContain("Invalid arguments");
    expect(readTextContent(firstToolContentBlock(result))).toContain("input.exchange is required");
    expect(mockMarketDataServices.inspectCoverage).not.toHaveBeenCalled();
  });

  it("rejects create_dataset_snapshot with unsupported timeframe", async () => {
    const result = await client.callTool({
      name: "create_dataset_snapshot",
      arguments: {
        request_id: "r-1",
        symbol: "BTC",
        exchange: "Hyperliquid",
        timeframe: "10m",
        start_time: "2024-01-01",
        end_time: "2024-01-02",
      },
    });

    expect(result.isError).toBe(true);
    expect(readTextContent(firstToolContentBlock(result))).toContain("Invalid arguments");
    expect(readTextContent(firstToolContentBlock(result))).toContain("input.timeframe");
    expect(mockMarketDataServices.inspectCoverage).not.toHaveBeenCalled();
  });
});
