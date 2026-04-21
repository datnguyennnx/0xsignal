import { beforeEach, describe, expect, it, vi } from "vitest";
import { Effect, Layer, Context } from "effect";
import { ALL_TOOLS } from "../registry";
import { MarketDataServices } from "../../../application/market-data/contracts";
import { BacktestServices } from "../../../application/backtest/service";
import { AgentServices } from "../../../application/agent/service";

describe("Market Data MCP Tools Smoke Proof", () => {
  const mockMarketDataServices = {
    discoverMarkets: vi.fn(),
    getCandles: vi.fn(),
    getRecentCandles: vi.fn(),
    inspectCoverage: vi.fn(),
    createDatasetSnapshot: vi.fn(),
    requestCandlesticks: vi.fn(),
    getDatasetSnapshot: vi.fn(),
  };

  const mockAgentServices = {
    openSession: vi.fn(),
    getSession: vi.fn(),
    savePlan: vi.fn(),
    recordAction: vi.fn(),
  };

  const mockBacktestServices = {
    createBacktestRun: vi.fn(),
    saveRunInput: vi.fn(),
    getRunSummary: vi.fn(),
    appendRunEvent: vi.fn(),
    recordMetric: vi.fn(),
  };

  const TestContext = Layer.mergeAll(
    Layer.succeed(
      MarketDataServices,
      mockMarketDataServices as unknown as Context.Tag.Service<typeof MarketDataServices>
    ),
    Layer.succeed(
      AgentServices,
      mockAgentServices as unknown as Context.Tag.Service<typeof AgentServices>
    ),
    Layer.succeed(
      BacktestServices,
      mockBacktestServices as unknown as Context.Tag.Service<typeof BacktestServices>
    )
  );

  type SmokeTestServices = MarketDataServices | AgentServices | BacktestServices;

  const runWithSmokeContext = <A, E>(effect: Effect.Effect<A, E, SmokeTestServices>): Promise<A> =>
    Effect.runPromise(effect.pipe(Effect.provide(TestContext)) as Effect.Effect<A, E, never>);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const getTool = (name: string) => {
    const tool = ALL_TOOLS.find((t) => t.name === name);
    if (!tool) throw new Error(`Tool ${name} not found in registry`);
    return tool;
  };

  it("get_candles: should return data with provenance", async () => {
    const tool = getTool("get_candles");
    mockMarketDataServices.getCandles.mockReturnValue(
      Effect.succeed({
        candles: [{ open: 60000 }],
        provenance: "QuestDB (Historical + Gap Fill)",
        coverage: { expectedCount: 1, fullCoverage: true, missingWindows: [] },
      })
    );

    const result = (await runWithSmokeContext(
      tool.execute({ symbol: "BTC", interval: "1h" } as never) as Effect.Effect<
        unknown,
        unknown,
        SmokeTestServices
      >
    )) as { candles: unknown[]; provenance: string };

    expect(result.candles).toHaveLength(1);
    expect(result.provenance).toBe("QuestDB (Historical + Gap Fill)");
    expect(mockMarketDataServices.getCandles).toHaveBeenCalledWith(
      expect.objectContaining({ symbol: "BTC", timeframe: "1h" })
    );
  });

  it("inspect_candle_coverage: should return row counts", async () => {
    const tool = getTool("inspect_candle_coverage");
    mockMarketDataServices.inspectCoverage.mockReturnValue(
      Effect.succeed({
        hasData: true,
        rowCount: 100,
        expectedCount: 100,
        fullCoverage: true,
        missingWindows: [],
      })
    );

    const result = (await runWithSmokeContext(
      tool.execute({
        symbol: "ETH",
        interval: "1m",
        start_time: "2024-01-01",
        end_time: "2024-01-02",
      } as never) as Effect.Effect<unknown, unknown, SmokeTestServices>
    )) as { rowCount: number; hasData: boolean };

    expect(result.rowCount).toBe(100);
    expect(result.hasData).toBe(true);
  });

  it("create_dataset_snapshot: should reject if coverage is missing", async () => {
    const tool = getTool("create_dataset_snapshot");
    mockMarketDataServices.inspectCoverage.mockReturnValue(
      Effect.succeed({
        hasData: false,
        rowCount: 0,
        expectedCount: 24,
        fullCoverage: false,
        missingWindows: [],
      })
    );

    await expect(
      runWithSmokeContext(
        tool.execute({
          request_id: "r1",
          symbol: "SOL",
          exchange: "Hyperliquid",
          timeframe: "1h",
          start_time: "2024-01-01",
          end_time: "2024-01-02",
          checksum: "abc",
        } as never) as Effect.Effect<unknown, unknown, SmokeTestServices>
      )
    ).rejects.toThrow(/Incomplete strict coverage/);

    expect(mockMarketDataServices.createDatasetSnapshot).not.toHaveBeenCalled();
  });

  it("create_dataset_snapshot: should succeed if coverage is valid", async () => {
    const tool = getTool("create_dataset_snapshot");
    mockMarketDataServices.inspectCoverage.mockReturnValue(
      Effect.succeed({
        hasData: true,
        rowCount: 24,
        expectedCount: 24,
        fullCoverage: true,
        missingWindows: [],
      })
    );
    mockMarketDataServices.createDatasetSnapshot.mockReturnValue(
      Effect.succeed({ id: "snap-42", symbol: "SOL", timeframe: "1h", row_count: 24 })
    );

    const result = (await runWithSmokeContext(
      tool.execute({
        request_id: "r1",
        symbol: "SOL",
        exchange: "Hyperliquid",
        timeframe: "1h",
        start_time: "2024-01-01",
        end_time: "2024-01-02",
        checksum: "abc",
      } as never) as Effect.Effect<unknown, unknown, SmokeTestServices>
    )) as { snapshot_id: string; provenance: string; completeness: { semantics: string } };

    expect(result.snapshot_id).toBe("snap-42");
    expect(result.provenance).toContain("QuestDB (Strict Coverage Verified");
    expect(result.completeness.semantics).toBe("strict");
    expect(mockMarketDataServices.createDatasetSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        query_fingerprint: "SOL|Hyperliquid|1h|2024-01-01|2024-01-02|strict",
        source_series: expect.objectContaining({
          source: "questdb",
          completeness_semantics: "strict",
        }),
      })
    );
  });

  it("create_dataset_snapshot: should reject strict-incomplete coverage even if fullCoverage=true", async () => {
    const tool = getTool("create_dataset_snapshot");
    mockMarketDataServices.inspectCoverage.mockReturnValue(
      Effect.succeed({
        hasData: true,
        rowCount: 23,
        expectedCount: 24,
        fullCoverage: true,
        missingWindows: [],
      })
    );

    await expect(
      runWithSmokeContext(
        tool.execute({
          request_id: "r1",
          symbol: "SOL",
          exchange: "Hyperliquid",
          timeframe: "1h",
          start_time: "2024-01-01",
          end_time: "2024-01-02",
        } as never) as Effect.Effect<unknown, unknown, SmokeTestServices>
      )
    ).rejects.toThrow(/Incomplete strict coverage/);

    expect(mockMarketDataServices.createDatasetSnapshot).not.toHaveBeenCalled();
  });

  it("create_dataset_snapshot: should reject invalid start_time", async () => {
    const tool = getTool("create_dataset_snapshot");

    await expect(
      runWithSmokeContext(
        tool.execute({
          request_id: "r1",
          symbol: "SOL",
          exchange: "Hyperliquid",
          timeframe: "1h",
          start_time: "not-a-date",
          end_time: "2024-01-02",
        } as never) as Effect.Effect<unknown, unknown, SmokeTestServices>
      )
    ).rejects.toThrow(/Invalid date for start_time/);

    expect(mockMarketDataServices.inspectCoverage).not.toHaveBeenCalled();
  });

  it("create_dataset_snapshot: should reject when start_time is after end_time", async () => {
    const tool = getTool("create_dataset_snapshot");

    await expect(
      runWithSmokeContext(
        tool.execute({
          request_id: "r1",
          symbol: "SOL",
          exchange: "Hyperliquid",
          timeframe: "1h",
          start_time: "2024-01-03",
          end_time: "2024-01-02",
        } as never) as Effect.Effect<unknown, unknown, SmokeTestServices>
      )
    ).rejects.toThrow(/start_time must be less than or equal to end_time/);

    expect(mockMarketDataServices.inspectCoverage).not.toHaveBeenCalled();
  });

  it("ensure_candle_coverage: should reject invalid end_time", async () => {
    const tool = getTool("ensure_candle_coverage");

    await expect(
      runWithSmokeContext(
        tool.execute({
          symbol: "ETH",
          interval: "1m",
          start_time: "2024-01-01",
          end_time: "not-a-date",
        } as never) as Effect.Effect<unknown, unknown, SmokeTestServices>
      )
    ).rejects.toThrow(/Invalid date for end_time/);

    expect(mockMarketDataServices.getCandles).not.toHaveBeenCalled();
  });

  it("inspect_candle_coverage: should reject invalid end_time", async () => {
    const tool = getTool("inspect_candle_coverage");

    await expect(
      runWithSmokeContext(
        tool.execute({
          symbol: "ETH",
          interval: "1m",
          start_time: "2024-01-01",
          end_time: "not-a-date",
        } as never) as Effect.Effect<unknown, unknown, SmokeTestServices>
      )
    ).rejects.toThrow(/Invalid date for end_time/);

    expect(mockMarketDataServices.inspectCoverage).not.toHaveBeenCalled();
  });

  it("discover_markets: should return metadata", async () => {
    const tool = getTool("discover_markets");
    mockMarketDataServices.discoverMarkets.mockReturnValue(Effect.succeed({ universe: [] }));

    const result = (await runWithSmokeContext(
      tool.execute({} as never) as Effect.Effect<unknown, unknown, SmokeTestServices>
    )) as { universe: unknown[] };

    expect(result.universe).toBeDefined();
    expect(mockMarketDataServices.discoverMarkets).toHaveBeenCalled();
  });

  it("correlation: should propagate interactionId to MarketDataServices", async () => {
    const tool = getTool("create_candlestick_request");
    mockMarketDataServices.requestCandlesticks.mockReturnValue(
      Effect.succeed({ id: "req-1", symbol: "BTC", base_timeframe: "1h" })
    );

    await runWithSmokeContext(
      tool.execute({
        symbol: "BTC",
        interval: "1h",
        _interactionId: "trace-999",
      } as never) as Effect.Effect<unknown, unknown, SmokeTestServices>
    );

    expect(mockMarketDataServices.requestCandlesticks).toHaveBeenCalledWith(
      expect.objectContaining({ requested_by_interaction_id: "trace-999" })
    );
  });

  it("start_backtest_run: should execute without errors", async () => {
    const tool = getTool("start_backtest_run");
    mockBacktestServices.createBacktestRun.mockReturnValue(
      Effect.succeed({ id: "run-1", status: "pending" })
    );

    const result = (await runWithSmokeContext(
      tool.execute({
        strategy_version_id: "s1",
        dataset_snapshot_id: "d1",
      } as never) as Effect.Effect<unknown, unknown, SmokeTestServices>
    )) as { run_id: string };

    expect(result.run_id).toBe("run-1");
  });
});
