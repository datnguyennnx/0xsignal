import { describe, it, expect, vi, beforeEach } from "vitest";
import { Effect, Layer } from "effect";
import {
  makeMarketDataService,
  MarketDataServices,
  MarketCandleStore,
  MarketRemoteProvider,
  isCoverageCompleteStrict,
  type MarketCandleStorePort,
  type MarketRemoteProviderPort,
} from "../market-data";
import type { Candle } from "@schemas/market-data";
import type { MarketDataRepository } from "../ports/market-data-repository";

const mkCandle = (timestamp: Date, price: number): Candle => ({
  timestamp,
  open: price,
  high: price,
  low: price,
  close: price,
  volume: 1,
});

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
    getTicker: vi.fn(),
  };

  const TestCandleRepo = Layer.succeed(
    MarketCandleStore,
    mockCandleRepo as unknown as MarketCandleStorePort
  );
  const TestHLProvider = Layer.succeed(
    MarketRemoteProvider,
    mockHLProvider as unknown as MarketRemoteProviderPort
  );
  const TestContext = Layer.mergeAll(TestCandleRepo, TestHLProvider);

  const mockRepo = {} as unknown as MarketDataRepository;

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
    mockCandleRepo.getCandles.mockReturnValue(Effect.succeed([mkCandle(new Date(0), 1)]));

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
    mockCandleRepo.getCandles.mockReturnValue(Effect.succeed([mkCandle(new Date(0), 2)]));
    mockHLProvider.getCandleSnapshot.mockReturnValue(Effect.succeed([mkCandle(new Date(), 999)]));
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

  it("getCandles - range requests should preserve limit in service query (repo decides cap)", async () => {
    const start = new Date("2024-01-01T00:00:00.000Z");
    const end = new Date("2024-01-01T01:00:00.000Z");

    mockCandleRepo.checkCoverage.mockReturnValue(
      Effect.succeed({
        hasData: true,
        rowCount: 61,
        expectedCount: 61,
        fullCoverage: true,
        missingWindows: [],
      })
    );
    mockCandleRepo.getCandles.mockReturnValue(Effect.succeed([mkCandle(new Date(0), 1)]));

    const MarketDataServicesTest = Layer.effect(
      MarketDataServices,
      makeMarketDataService(mockRepo)
    ).pipe(Layer.provide(TestContext));

    await Effect.runPromise(
      Effect.flatMap(MarketDataServices, (s) =>
        s.getCandles({
          symbol: "BTC",
          exchange: "Hyperliquid",
          timeframe: "1m",
          startTime: start,
          endTime: end,
          limit: 50,
        })
      ).pipe(Effect.provide(MarketDataServicesTest))
    );

    expect(mockCandleRepo.getCandles).toHaveBeenCalledWith(
      expect.objectContaining({
        symbol: "BTC",
        exchange: "Hyperliquid",
        timeframe: "1m",
        startTime: start,
        endTime: end,
        limit: 50,
      })
    );
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

  it("getCandles should return strictly ascending unique timestamps", async () => {
    const t1 = new Date("2024-01-01T00:00:00.000Z");
    const t2 = new Date("2024-01-01T00:01:00.000Z");
    const t3 = new Date("2024-01-01T00:02:00.000Z");

    mockCandleRepo.checkCoverage.mockReturnValue(
      Effect.succeed({
        hasData: true,
        rowCount: 4,
        expectedCount: 4,
        fullCoverage: true,
        missingWindows: [],
      })
    );

    mockCandleRepo.getCandles.mockReturnValue(
      Effect.succeed([
        { timestamp: t3, open: 3, high: 3, low: 3, close: 3, volume: 1 },
        { timestamp: t1, open: 1, high: 1, low: 1, close: 1, volume: 1 },
        { timestamp: t2, open: 2, high: 2, low: 2, close: 2, volume: 1 },
        { timestamp: t2, open: 22, high: 22, low: 22, close: 22, volume: 2 },
      ])
    );

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

    expect(result.candles.map((c) => c.timestamp.toISOString())).toEqual([
      "2024-01-01T00:00:00.000Z",
      "2024-01-01T00:01:00.000Z",
      "2024-01-01T00:02:00.000Z",
    ]);
    expect(result.candles[1].open).toBe(22);
  });

  it("getCandles should align misaligned range boundaries before coverage checks", async () => {
    const start = new Date("2024-01-01T00:00:00.001Z");
    const end = new Date("2024-01-01T00:03:59.999Z");

    mockCandleRepo.checkCoverage.mockReturnValue(
      Effect.succeed({
        hasData: true,
        rowCount: 4,
        expectedCount: 4,
        fullCoverage: true,
        missingWindows: [],
      })
    );
    mockCandleRepo.getCandles.mockReturnValue(Effect.succeed([]));

    const MarketDataServicesTest = Layer.effect(
      MarketDataServices,
      makeMarketDataService(mockRepo)
    ).pipe(Layer.provide(TestContext));

    await Effect.runPromise(
      Effect.flatMap(MarketDataServices, (s) =>
        s.getCandles({
          symbol: "BTC",
          exchange: "Hyperliquid",
          timeframe: "1m",
          startTime: start,
          endTime: end,
        })
      ).pipe(Effect.provide(MarketDataServicesTest))
    );

    expect(mockCandleRepo.checkCoverage).toHaveBeenCalledWith(
      "BTC",
      "Hyperliquid",
      "1m",
      new Date("2024-01-01T00:01:00.000Z"),
      new Date("2024-01-01T00:03:00.000Z")
    );
    expect(mockHLProvider.getCandleSnapshot).not.toHaveBeenCalled();
  });

  it("getTicker maps provider not found to domain not found", async () => {
    mockHLProvider.getTicker.mockReturnValue(Effect.fail({ kind: "NOT_FOUND", message: "nope" }));

    const MarketDataServicesTest = Layer.effect(
      MarketDataServices,
      makeMarketDataService(mockRepo)
    ).pipe(Layer.provide(TestContext));

    const program = Effect.flatMap(MarketDataServices, (s) => s.getTicker("XRP")).pipe(
      Effect.provide(MarketDataServicesTest)
    );

    await expect(Effect.runPromise(program)).rejects.toThrow('"code":"NOT_FOUND"');
  });

  it("getCandles should fill gaps when coverage is inconsistent", async () => {
    const start = new Date("2024-01-01T00:00:00.000Z");
    const end = new Date("2024-01-01T00:02:00.000Z");
    const t1 = new Date("2024-01-01T00:01:00.000Z");

    mockCandleRepo.checkCoverage
      .mockReturnValueOnce(
        Effect.succeed({
          hasData: true,
          rowCount: 3,
          expectedCount: 3,
          fullCoverage: true,
          missingWindows: [{ start: t1, end: t1 }],
        })
      )
      .mockReturnValueOnce(
        Effect.succeed({
          hasData: true,
          rowCount: 3,
          expectedCount: 3,
          fullCoverage: true,
          missingWindows: [],
        })
      );

    mockHLProvider.getCandleSnapshot.mockReturnValue(
      Effect.succeed([
        {
          timestamp: t1,
          open: 2,
          high: 2,
          low: 2,
          close: 2,
          volume: 1,
        },
      ])
    );
    mockCandleRepo.insertCandles.mockReturnValue(Effect.succeed(undefined));
    mockCandleRepo.getCandles.mockReturnValue(
      Effect.succeed([
        { timestamp: start, open: 1, high: 1, low: 1, close: 1, volume: 1 },
        { timestamp: t1, open: 2, high: 2, low: 2, close: 2, volume: 1 },
        { timestamp: end, open: 3, high: 3, low: 3, close: 3, volume: 1 },
      ])
    );

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
          startTime: start,
          endTime: end,
        })
      ).pipe(Effect.provide(MarketDataServicesTest))
    );

    expect(mockHLProvider.getCandleSnapshot).toHaveBeenCalled();
    expect(mockCandleRepo.insertCandles).toHaveBeenCalled();
    expect(mockCandleRepo.checkCoverage).toHaveBeenCalledTimes(2);
    expect(result.provenance).toContain("Fully Covered");
  });

  it("getCandles should reject unboundedly large ranges", async () => {
    mockCandleRepo.checkCoverage.mockReturnValue(
      Effect.succeed({
        hasData: false,
        rowCount: 0,
        expectedCount: 0,
        fullCoverage: false,
        missingWindows: [],
      })
    );

    const MarketDataServicesTest = Layer.effect(
      MarketDataServices,
      makeMarketDataService(mockRepo)
    ).pipe(Layer.provide(TestContext));

    const program = Effect.flatMap(MarketDataServices, (s) =>
      s.getCandles({
        symbol: "BTC",
        exchange: "Hyperliquid",
        timeframe: "1m",
        startTime: new Date("2024-01-01T00:00:00.000Z"),
        endTime: new Date("2024-02-01T00:00:00.000Z"),
      })
    ).pipe(Effect.provide(MarketDataServicesTest));

    await expect(Effect.runPromise(program)).rejects.toThrow("Requested range is too large");
    expect(mockCandleRepo.checkCoverage).not.toHaveBeenCalled();
  });

  it("strict coverage helper should enforce rowCount and windows", () => {
    expect(
      isCoverageCompleteStrict({
        hasData: true,
        rowCount: 23,
        expectedCount: 24,
        fullCoverage: true,
        missingWindows: [],
      })
    ).toBe(false);

    expect(
      isCoverageCompleteStrict({
        hasData: true,
        rowCount: 24,
        expectedCount: 24,
        fullCoverage: true,
        missingWindows: [{ start: new Date("2024-01-01"), end: new Date("2024-01-01") }],
      })
    ).toBe(false);

    expect(
      isCoverageCompleteStrict({
        hasData: true,
        rowCount: 24,
        expectedCount: 24,
        fullCoverage: true,
        missingWindows: [],
      })
    ).toBe(true);
  });

  it("getRecentCandles should fetch directly from Hyperliquid snapshot lane", async () => {
    const end = new Date("2024-01-01T00:10:00.000Z");
    mockHLProvider.getCandleSnapshot.mockReturnValue(
      Effect.succeed([
        {
          timestamp: new Date("2024-01-01T00:09:00.000Z"),
          open: 9,
          high: 9,
          low: 9,
          close: 9,
          volume: 1,
        },
        {
          timestamp: new Date("2024-01-01T00:10:00.000Z"),
          open: 10,
          high: 10,
          low: 10,
          close: 10,
          volume: 1,
        },
      ])
    );

    const MarketDataServicesTest = Layer.effect(
      MarketDataServices,
      makeMarketDataService(mockRepo)
    ).pipe(Layer.provide(TestContext));

    const result = await Effect.runPromise(
      Effect.flatMap(MarketDataServices, (s) =>
        s.getRecentCandles({
          symbol: "BTC",
          timeframe: "1m",
          endTime: end,
          limit: 2,
        })
      ).pipe(Effect.provide(MarketDataServicesTest))
    );

    expect(mockHLProvider.getCandleSnapshot).toHaveBeenCalled();
    expect(mockCandleRepo.checkCoverage).not.toHaveBeenCalled();
    expect(mockCandleRepo.getCandles).not.toHaveBeenCalled();
    expect(result.provenance).toContain("Hyperliquid Snapshot (Recent");
    expect(result.coverage.expectedCount).toBe(2);
    expect(result.candles).toHaveLength(2);
  });

  it("getRecentCandles should reject non-Hyperliquid exchanges", async () => {
    const MarketDataServicesTest = Layer.effect(
      MarketDataServices,
      makeMarketDataService(mockRepo)
    ).pipe(Layer.provide(TestContext));

    const program = Effect.flatMap(MarketDataServices, (s) =>
      s.getRecentCandles({
        symbol: "BTC",
        exchange: "Binance",
        timeframe: "1m",
      })
    ).pipe(Effect.provide(MarketDataServicesTest));

    await expect(Effect.runPromise(program)).rejects.toThrow(
      "Recent candle snapshots are currently supported only for Hyperliquid"
    );
  });
});
