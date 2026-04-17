import { beforeEach, describe, expect, it, vi } from "vitest";
import { Effect, Layer } from "effect";
import { MarketDataServices } from "@application/market-data";
import {
  discoverMarketsTool,
  getCandlesTool,
  inspectCandleCoverageTool,
  ensureCandleCoverageTool,
} from "../tools";

describe("MCP Market Data Tools Wiring", () => {
  const mockMarketDataServices = {
    discoverMarkets: vi.fn(),
    getCandles: vi.fn(),
    inspectCoverage: vi.fn(),
    createDatasetSnapshot: vi.fn(),
    requestCandlesticks: vi.fn(),
    getDatasetSnapshot: vi.fn(),
  };

  const TestMarketData = Layer.succeed(MarketDataServices, mockMarketDataServices as any);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("discover_markets calls service", async () => {
    mockMarketDataServices.discoverMarkets.mockReturnValue(Effect.succeed({ coins: [] }));
    await Effect.runPromise(discoverMarketsTool.execute().pipe(Effect.provide(TestMarketData)));
    expect(mockMarketDataServices.discoverMarkets).toHaveBeenCalled();
  });

  it("get_candles calls service with parsed dates", async () => {
    mockMarketDataServices.getCandles.mockReturnValue(
      Effect.succeed({
        candles: [],
        provenance: "test",
        coverage: { expectedCount: 0, fullCoverage: true, missingWindows: [] },
      })
    );

    await Effect.runPromise(
      getCandlesTool
        .execute({
          symbol: "BTC",
          interval: "1h",
          start_time: "2024-01-01T00:00:00Z",
        })
        .pipe(Effect.provide(TestMarketData))
    );

    expect(mockMarketDataServices.getCandles).toHaveBeenCalledWith(
      expect.objectContaining({
        symbol: "BTC",
        timeframe: "1h",
        startTime: expect.any(Date),
      })
    );
  });

  it("inspect_candle_coverage calls service", async () => {
    mockMarketDataServices.inspectCoverage.mockReturnValue(
      Effect.succeed({
        hasData: true,
        rowCount: 10,
        expectedCount: 10,
        fullCoverage: true,
        missingWindows: [],
      })
    );

    await Effect.runPromise(
      inspectCandleCoverageTool
        .execute({
          symbol: "ETH",
          interval: "1m",
          start_time: "2024-01-01",
          end_time: "2024-01-02",
        })
        .pipe(Effect.provide(TestMarketData))
    );

    expect(mockMarketDataServices.inspectCoverage).toHaveBeenCalled();
  });

  it("ensure_candle_coverage orchestrates gap filling and returns verification", async () => {
    mockMarketDataServices.getCandles.mockReturnValue(
      Effect.succeed({
        candles: [{}],
        provenance: "retrieved",
        coverage: { rowCount: 1, expectedCount: 1, fullCoverage: true, missingWindows: [] },
      })
    );

    const result = await Effect.runPromise(
      ensureCandleCoverageTool
        .execute({
          symbol: "SOL",
          interval: "1h",
          start_time: "2024-01-01",
          end_time: "2024-01-02",
        })
        .pipe(Effect.provide(TestMarketData))
    );

    expect(mockMarketDataServices.getCandles).toHaveBeenCalled();
    expect(result.status).toBe("Coverage Verified (FULL)");
    expect(result.returnedCandleCount).toBe(1);
    expect(result.rowCount).toBe(1);
  });
});
