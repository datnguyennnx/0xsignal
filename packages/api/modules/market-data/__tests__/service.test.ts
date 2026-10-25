import { describe, expect, it } from "vitest";
import { Effect, Layer, Schema } from "effect";
import { mapServiceError } from "../../../app/error-mapping";
import { MarketCandleStore, MarketDataService, MarketRemoteProvider } from "../index";
import { marketDataServiceLayer } from "../layer";
import { MAX_RANGE_CANDLES } from "../policies";
import { MarketTimeframeSchema } from "../timeframe";
import { ValidationError } from "../../../shared/errors";

const timeframe = Schema.decodeUnknownSync(MarketTimeframeSchema)("1m");
const BASE = Date.UTC(2024, 0, 1);
const INTERVAL_MS = 60_000;

const TestStoreLayer = Layer.succeed(
  MarketCandleStore,
  MarketCandleStore.of({ getCandles: () => Effect.succeed([]) }),
);

const TestProviderLayer = Layer.succeed(
  MarketRemoteProvider,
  MarketRemoteProvider.of({
    getCandleSnapshot: () => Effect.succeed([]),
    getAggregatedMarkets: () => Effect.succeed([]),
  }),
);

const TestLayer = marketDataServiceLayer.pipe(
  Layer.provideMerge(Layer.mergeAll(TestStoreLayer, TestProviderLayer)),
);

const runGetCandles = (candleCount: number) =>
  Effect.gen(function* () {
    const service = yield* MarketDataService;
    return yield* service.getCandles({
      symbol: "BTC",
      exchange: "Hyperliquid",
      timeframe,
      startTime: new Date(BASE),
      endTime: new Date(BASE + candleCount * INTERVAL_MS),
    });
  }).pipe(Effect.provide(TestLayer));

describe("market data service candle range", () => {
  it("caps the range at Hyperliquid's 5000-candle limit", () => {
    expect(MAX_RANGE_CANDLES).toBe(5000);
  });

  it("rejects a 6000-candle range with a 400 validation error", async () => {
    const error = await Effect.runPromise(Effect.flip(runGetCandles(6000)));

    expect(error instanceof ValidationError).toBe(true);
    expect(error.message).toContain("Maximum is 5000");
    expect(mapServiceError(error).status).toBe(400);
  });

  it("admits a range exactly at the limit", async () => {
    const result = await Effect.runPromise(runGetCandles(MAX_RANGE_CANDLES - 1));

    expect(result.coverage.expectedCount).toBe(MAX_RANGE_CANDLES);
  });
});
