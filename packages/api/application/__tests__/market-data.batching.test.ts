import { beforeEach, describe, expect, it, vi } from "vitest";
import { Effect, Layer } from "effect";
import {
  makeMarketDataService,
  MarketDataServices,
  MarketCandleStore,
  MarketRemoteProvider,
  type MarketCandleStorePort,
  type MarketRemoteProviderPort,
} from "../market-data";
import type { Candle } from "@schemas/market-data";
import type { MarketDataRepository } from "../ports/market-data-repository";

const mkCandle = (timestampMs: number, price: number): Candle => ({
  timestamp: new Date(timestampMs),
  open: price,
  high: price,
  low: price,
  close: price,
  volume: 1,
});

describe("MarketDataServices Batching", () => {
  const mockRepo = {} as unknown as MarketDataRepository;

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
    Layer.succeed(MarketCandleStore, mockCandleRepo as unknown as MarketCandleStorePort),
    Layer.succeed(MarketRemoteProvider, mockHLProvider as unknown as MarketRemoteProviderPort)
  );

  const MarketDataServicesTest = Layer.effect(
    MarketDataServices,
    makeMarketDataService(mockRepo)
  ).pipe(Layer.provide(TestContext));

  const run = <A>(program: Effect.Effect<A, unknown, MarketDataServices>) =>
    Effect.runPromise(program.pipe(Effect.provide(MarketDataServicesTest)));

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getCandles should fetch in batches if HL returns full 5000 batch", async () => {
    mockCandleRepo.checkCoverage
      .mockReturnValueOnce(
        Effect.succeed({
          hasData: false,
          rowCount: 0,
          expectedCount: 6000,
          fullCoverage: false,
          missingWindows: [{ start: new Date(0), end: new Date(10000) }],
        })
      )
      .mockReturnValueOnce(
        Effect.succeed({
          hasData: true,
          rowCount: 6000,
          expectedCount: 6000,
          fullCoverage: true,
          missingWindows: [],
        })
      );

    const firstBatch = Array.from({ length: 5000 }, (_, i) => mkCandle(1000 + i, 1));
    const secondBatch = Array.from({ length: 1000 }, (_, i) => mkCandle(6000 + i, 2));

    mockHLProvider.getCandleSnapshot
      .mockReturnValueOnce(Effect.succeed(firstBatch))
      .mockReturnValueOnce(Effect.succeed(secondBatch));

    mockCandleRepo.insertCandles.mockReturnValue(Effect.succeed(undefined));
    mockCandleRepo.getCandles.mockReturnValue(Effect.succeed([...firstBatch, ...secondBatch]));

    const result = await run(
      Effect.flatMap(MarketDataServices, (service) =>
        service.getCandles({
          symbol: "BTC",
          exchange: "Hyperliquid",
          timeframe: "1m",
          startTime: new Date(0),
          endTime: new Date(10000),
        })
      )
    );

    expect(mockHLProvider.getCandleSnapshot).toHaveBeenCalledTimes(2);
    expect(result.candles).toHaveLength(6000);
    expect(result.provenance).toContain("QuestDB");
    expect(mockCandleRepo.insertCandles).toHaveBeenCalledTimes(2);
  });

  it("getCandles should stop early if provider returns fewer than MAX_BATCH_SIZE", async () => {
    mockCandleRepo.checkCoverage
      .mockReturnValueOnce(
        Effect.succeed({
          hasData: false,
          rowCount: 0,
          expectedCount: 100,
          fullCoverage: false,
          missingWindows: [{ start: new Date(0), end: new Date(10000) }],
        })
      )
      .mockReturnValueOnce(
        Effect.succeed({
          hasData: true,
          rowCount: 100,
          expectedCount: 100,
          fullCoverage: true,
          missingWindows: [],
        })
      );

    const partialBatch = Array.from({ length: 100 }, (_, i) => mkCandle(1000 + i, 1));

    mockHLProvider.getCandleSnapshot.mockReturnValueOnce(Effect.succeed(partialBatch));
    mockCandleRepo.insertCandles.mockReturnValue(Effect.succeed(undefined));
    mockCandleRepo.getCandles.mockReturnValue(Effect.succeed(partialBatch));

    const result = await run(
      Effect.flatMap(MarketDataServices, (service) =>
        service.getCandles({
          symbol: "BTC",
          exchange: "Hyperliquid",
          timeframe: "1m",
        })
      )
    );

    expect(mockHLProvider.getCandleSnapshot).toHaveBeenCalledTimes(1);
    expect(result.candles).toHaveLength(100);
  });
});
