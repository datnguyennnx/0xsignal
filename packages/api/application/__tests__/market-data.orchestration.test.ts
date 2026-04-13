import { describe, it, expect, vi, beforeEach } from "vitest";
import { Effect, Layer } from "effect";
import { makeMarketDataService, MarketDataServices } from "../market-data";
import { CandleRepository } from "@infrastructure/db/questdb/repositories/candle";
import { HyperliquidProvider } from "@infrastructure/data-sources/hyperliquid/providers";

describe("MarketDataServices Orchestration", () => {
  const mockCandleRepo = {
    checkCoverage: vi.fn(),
    getCandles: vi.fn(),
    insertCandles: vi.fn(),
    initializeSchema: vi.fn(),
  };

  const mockHLProvider = {
    getCandleSnapshot: vi.fn(),
    getMetadata: vi.fn(),
  };

  const TestCandleRepo = Layer.succeed(CandleRepository, mockCandleRepo as any);
  const TestHLProvider = Layer.succeed(HyperliquidProvider, mockHLProvider as any);
  const TestContext = Layer.mergeAll(TestCandleRepo, TestHLProvider);

  const mockRepo = {} as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getCandles - cache hit path: should NOT call HL provider if QuestDB has data", async () => {
    mockCandleRepo.checkCoverage.mockReturnValue(
      Effect.succeed({
        hasData: true,
        rowCount: 1,
        expectedCount: 1,
        fullCoverage: true,
        missingWindows: [],
      })
    );
    mockCandleRepo.getCandles.mockReturnValue(Effect.succeed([{ open: 1 } as any]));

    const MarketDataServicesTest = Layer.effect(
      MarketDataServices,
      makeMarketDataService(mockRepo)
    ).pipe(Layer.provide(TestContext));

    const result = await Effect.runPromise(
      Effect.flatMap(MarketDataServices, (s) =>
        s.getCandles({
          symbol: "BTC",
          exchange: "Hyperliquid",
          timeframe: "1m",
        })
      ).pipe(Effect.provide(MarketDataServicesTest))
    );

    expect(mockCandleRepo.getCandles).toHaveBeenCalled();
    expect(mockHLProvider.getCandleSnapshot).not.toHaveBeenCalled();
    expect(result.provenance).toContain("QuestDB (Fully Covered)");
    expect(result.candles).toHaveLength(1);
  });

  it("getCandles - cache miss path: should call HL provider and persist if QuestDB is empty", async () => {
    mockCandleRepo.checkCoverage
      .mockReturnValueOnce(
        Effect.succeed({
          hasData: false,
          rowCount: 0,
          expectedCount: 1,
          fullCoverage: false,
          missingWindows: [{ start: new Date(0), end: new Date() }],
        })
      )
      .mockReturnValueOnce(
        Effect.succeed({
          hasData: true,
          rowCount: 1,
          expectedCount: 1,
          fullCoverage: true,
          missingWindows: [],
        })
      );
    mockCandleRepo.getCandles.mockReturnValue(Effect.succeed([{ open: 2 } as any]));
    mockHLProvider.getCandleSnapshot.mockReturnValue(
      Effect.succeed([{ timestamp: new Date(), open: 2 } as any])
    );
    mockCandleRepo.insertCandles.mockReturnValue(Effect.succeed(undefined));

    const MarketDataServicesTest = Layer.effect(
      MarketDataServices,
      makeMarketDataService(mockRepo)
    ).pipe(Layer.provide(TestContext));

    const result = await Effect.runPromise(
      Effect.flatMap(MarketDataServices, (s) =>
        s.getCandles({
          symbol: "BTC",
          exchange: "Hyperliquid",
          timeframe: "1m",
        })
      ).pipe(Effect.provide(MarketDataServicesTest))
    );

    expect(mockCandleRepo.getCandles).toHaveBeenCalled();
    expect(mockHLProvider.getCandleSnapshot).toHaveBeenCalled();
    expect(mockCandleRepo.insertCandles).toHaveBeenCalled();
    expect(result.provenance).toContain("QuestDB");
    expect(result.candles[0].open).toBe(2);
  });

  it("getCandles should fail if startTime is after endTime", async () => {
    const MarketDataServicesTest = Layer.effect(
      MarketDataServices,
      makeMarketDataService(mockRepo)
    ).pipe(Layer.provide(TestContext));

    const program = Effect.flatMap(MarketDataServices, (s) =>
      s.getCandles({
        symbol: "BTC",
        exchange: "Hyperliquid",
        timeframe: "1m",
        startTime: new Date("2024-01-02"),
        endTime: new Date("2024-01-01"),
      })
    ).pipe(Effect.provide(MarketDataServicesTest));

    await expect(Effect.runPromise(program)).rejects.toThrow("Start time must be before end time");
  });
});
