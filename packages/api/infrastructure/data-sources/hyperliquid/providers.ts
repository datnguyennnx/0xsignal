import { Effect, Context, Data, Layer } from "effect";
import { normalizeCandles, toHlInterval } from "./normalizer";
import { type Candle } from "../../../schemas/market-data";
import { HyperliquidClient } from "./client";
import type { Timeframe } from "../../db/questdb/queries/candle";

export class HyperliquidError extends Data.TaggedError("HyperliquidError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class HyperliquidProvider extends Context.Tag("HyperliquidProvider")<
  HyperliquidProvider,
  {
    readonly getCandleSnapshot: (
      coin: string,
      interval: Timeframe,
      startTime: number,
      endTime: number
    ) => Effect.Effect<Candle[], HyperliquidError>;
    readonly getAllMids: () => Effect.Effect<Record<string, string>, HyperliquidError>;
    readonly getMetadata: () => Effect.Effect<unknown, HyperliquidError>;
  }
>() {}

type HyperliquidClientService = Context.Tag.Service<typeof HyperliquidClient>;

export const getCandleSnapshot = (
  coin: string,
  interval: Timeframe,
  startTime: number,
  endTime: number
): Effect.Effect<Candle[], HyperliquidError, HyperliquidClient> =>
  Effect.gen(function* () {
    const { info } = yield* HyperliquidClient;

    return yield* Effect.tryPromise({
      try: async () => {
        const candles = await info.candleSnapshot({
          coin,
          interval: toHlInterval(interval),
          startTime,
          endTime,
        });
        return normalizeCandles(candles);
      },
      catch: (cause) =>
        new HyperliquidError({
          message: `Failed to fetch candles for ${coin} (${interval})`,
          cause,
        }),
    });
  });

export const getAllMids = (): Effect.Effect<
  Record<string, string>,
  HyperliquidError,
  HyperliquidClient
> =>
  Effect.gen(function* () {
    const { info } = yield* HyperliquidClient;
    return yield* Effect.tryPromise({
      try: () => info.allMids(),
      catch: (cause) =>
        new HyperliquidError({
          message: "Failed to fetch all mids",
          cause,
        }),
    });
  });

export const getMetadata = (): Effect.Effect<unknown, HyperliquidError, HyperliquidClient> =>
  Effect.gen(function* () {
    const { info } = yield* HyperliquidClient;
    return yield* Effect.tryPromise({
      try: () => info.meta(),
      catch: (cause) =>
        new HyperliquidError({
          message: "Failed to fetch Hyperliquid metadata",
          cause,
        }),
    });
  });

export const HyperliquidProviderLive = (client: HyperliquidClientService) =>
  HyperliquidProvider.of({
    getCandleSnapshot: (coin, interval, start, end) =>
      getCandleSnapshot(coin, interval, start, end).pipe(
        Effect.provideService(HyperliquidClient, client)
      ),
    getAllMids: () => getAllMids().pipe(Effect.provideService(HyperliquidClient, client)),
    getMetadata: () => getMetadata().pipe(Effect.provideService(HyperliquidClient, client)),
  });

export const HyperliquidProviderLayer = Layer.effect(
  HyperliquidProvider,
  Effect.gen(function* () {
    const client = yield* HyperliquidClient;
    return HyperliquidProviderLive(client);
  })
);
