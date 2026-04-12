import { beforeEach, describe, expect, it, vi } from "vitest";
import { Effect, Layer } from "effect";
import { makeMarketDataService, MarketDataServices } from "../market-data";
import { CandleRepository } from "../../infrastructure/db/questdb/repositories/candle";
import { HyperliquidProvider } from "../../infrastructure/data-sources/hyperliquid/providers";

describe("Market Data Coverage Semantics", () => {
  const mockRepo = {} as any;

  const mockCandleRepo = {
    checkCoverage: vi.fn(),
    getCandles: vi.fn(),
    insertCandles: vi.fn(),
    getLatestTimestamp: vi.fn(),
    initializeSchema: vi.fn(),
  };

  const mockHLProvider = {
    getCandleSnapshot: vi.fn(),
    getAllMids: vi.fn(),
    getMetadata: vi.fn(),
  };

  const TestContext = Layer.mergeAll(
    Layer.succeed(CandleRepository, mockCandleRepo as any),
    Layer.succeed(HyperliquidProvider, mockHLProvider as any)
  );

  const MarketDataServicesTest = Layer.effect(
    MarketDataServices,
    makeMarketDataService(mockRepo)
  ).pipe(Layer.provide(TestContext));

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getCandles should fill gaps if local data is partial", async () => {
    const symbol = "BTC";
    const start = new Date("2024-01-01T00:00:00Z");
    const end = new Date("2024-01-01T01:00:00Z");

    mockCandleRepo.checkCoverage
      .mockReturnValueOnce(
        Effect.succeed({
          hasData: true,
          rowCount: 30,
          expectedCount: 61,
          fullCoverage: false,
          missingWindows: [{ start: new Date("2024-01-01T00:30:00Z"), end }],
        })
      )
      .mockReturnValueOnce(
        Effect.succeed({
          hasData: true,
          rowCount: 61,
          expectedCount: 61,
          fullCoverage: true,
          missingWindows: [],
        })
      );

    mockHLProvider.getCandleSnapshot.mockReturnValue(
      Effect.succeed([
        {
          timestamp: new Date("2024-01-01T00:30:00Z"),
          open: 1,
          high: 1,
          low: 1,
          close: 1,
          volume: 1,
        },
      ])
    );

    mockCandleRepo.insertCandles.mockReturnValue(Effect.succeed(undefined));
    mockCandleRepo.getCandles.mockReturnValue(Effect.succeed(new Array(61).fill({})));

    const program = Effect.flatMap(MarketDataServices, (service) =>
      service.getCandles({
        symbol,
        exchange: "Hyperliquid",
        timeframe: "1m",
        startTime: start,
        endTime: end,
      })
    ).pipe(Effect.provide(MarketDataServicesTest));

    const result = await Effect.runPromise(program);

    expect(mockCandleRepo.checkCoverage).toHaveBeenCalledTimes(2);
    expect(mockHLProvider.getCandleSnapshot).toHaveBeenCalled();
    expect(mockCandleRepo.insertCandles).toHaveBeenCalled();
    expect(result.candles.length).toBe(61);
    expect(result.provenance).toContain("Fully Covered");
  });
});
