import { Cache, Duration, Effect, Layer, Match, Schedule } from "effect";
import type { ExchangeClient } from "@nktkas/hyperliquid";
import { HyperliquidClient } from "../hyperliquid/contracts";
import { ExchangeService, type ExchangeError } from "./contracts";
import { HyperliquidInternalError } from "../../domain/errors";
import { classifyExchangeError, toHlTif } from "./error-classification";
import { ExchangeAccountRepo } from "@0xsignal/auth";
import { ExchangeCredentialRepo } from "@0xsignal/auth";
import {
  buildCoinToAsset,
  resolveExchangeCredentials,
} from "../../infrastructure/data-sources/hyperliquid/exchange-credentials";

const withExchangeClient = <A>(
  userId: string,
  accountRepo: typeof ExchangeAccountRepo.Service,
  credentialRepo: typeof ExchangeCredentialRepo.Service,
  metaCache: Cache.Cache<string, { universe: Array<{ name: string }> }, HyperliquidInternalError>,
  fn: (ctx: {
    exchange: ExchangeClient;
    vaultAddress: string | undefined;
    coinToAsset: Map<string, number>;
  }) => Effect.Effect<A, ExchangeError>,
): Effect.Effect<A, ExchangeError> =>
  Effect.gen(function* () {
    const { exchange, vaultAddress } = yield* resolveExchangeCredentials(
      userId,
      accountRepo,
      credentialRepo,
    );

    const meta = yield* getCachedMetaInner(metaCache);
    const coinToAsset = buildCoinToAsset(meta);

    return yield* fn({ exchange, vaultAddress, coinToAsset });
  });

const getCachedMetaInner = (
  cache: Cache.Cache<string, { universe: Array<{ name: string }> }, HyperliquidInternalError>,
): Effect.Effect<{ universe: Array<{ name: string }> }, HyperliquidInternalError> =>
  Cache.get(cache, "meta");

export const exchangeServiceLayer = Layer.effect(
  ExchangeService,
  Effect.gen(function* () {
    const { info } = yield* HyperliquidClient;
    const accountRepo = yield* ExchangeAccountRepo;
    const credentialRepo = yield* ExchangeCredentialRepo;

    const metaCache = yield* Cache.make<
      string,
      { universe: Array<{ name: string }> },
      HyperliquidInternalError
    >({
      capacity: 1,
      timeToLive: Duration.minutes(5),
      lookup: () =>
        Effect.tryPromise({
          try: () => info.meta(),
          catch: (e) =>
            new HyperliquidInternalError({
              message: "Failed to fetch market metadata",
              cause: e,
              endpoint: "info.meta()",
            }),
        }),
    });

    return ExchangeService.of({
      placeOrder: (params, userId) =>
        withExchangeClient(
          userId,
          accountRepo,
          credentialRepo,
          metaCache,
          ({ exchange, vaultAddress, coinToAsset }) =>
            Effect.gen(function* () {
              const hlOrders = yield* Effect.forEach(params.orders, (o) =>
                Effect.gen(function* () {
                  const a = coinToAsset.get(o.symbol);
                  if (a === undefined) {
                    return yield* Effect.fail(
                      new HyperliquidInternalError({
                        message: `Unknown coin: ${o.symbol}`,
                        symbol: o.symbol,
                      }),
                    );
                  }
                  return {
                    a,
                    b: o.side === "buy",
                    p: o.price,
                    s: o.quantity,
                    r: o.reduceOnly,
                    t:
                      o.orderType.kind === "limit"
                        ? ({ limit: { tif: toHlTif(o.orderType.timeInForce) } } as const)
                        : ({
                            trigger: {
                              isMarket: o.orderType.isMarket,
                              triggerPx: o.orderType.triggerPrice,
                              tpsl: o.orderType.tpsl,
                            },
                          } as const),
                  };
                }),
              );

              const orderOpts = vaultAddress ? { vaultAddress } : {};
              return yield* Effect.tryPromise({
                try: () =>
                  exchange.order(
                    { orders: hlOrders, grouping: params.grouping ?? "na" },
                    orderOpts,
                  ),
                catch: classifyExchangeError,
              }).pipe(
                Effect.retry({
                  schedule: Schedule.exponential("200 millis").pipe(Schedule.take(3)),
                  while: (error) =>
                    Match.value(error).pipe(
                      Match.tag("HyperliquidInternalError", () => true),
                      Match.orElse(() => false),
                    ),
                }),
                Effect.timeout("30 seconds"),
                Effect.catchTag("TimeoutError", () =>
                  Effect.fail(
                    new HyperliquidInternalError({
                      message: "Exchange order timed out",
                      endpoint: "exchange.order()",
                    }),
                  ),
                ),
              );
            }),
        ),

      updateLeverageAndMargin: (params, userId) =>
        withExchangeClient(
          userId,
          accountRepo,
          credentialRepo,
          metaCache,
          ({ exchange, vaultAddress, coinToAsset }) =>
            Effect.gen(function* () {
              const assetIndex = coinToAsset.get(params.symbol);
              if (assetIndex === undefined) {
                return yield* Effect.fail(
                  new HyperliquidInternalError({
                    message: `Unknown coin: ${params.symbol}`,
                    symbol: params.symbol,
                  }),
                );
              }

              const leverageOpts = vaultAddress ? { vaultAddress } : {};
              return yield* Effect.tryPromise({
                try: () =>
                  exchange.updateLeverage(
                    {
                      asset: assetIndex,
                      isCross: params.isCross,
                      leverage: params.leverage,
                    },
                    leverageOpts,
                  ),
                catch: classifyExchangeError,
              }).pipe(
                Effect.retry({
                  schedule: Schedule.exponential("200 millis").pipe(Schedule.take(3)),
                  while: (error) =>
                    Match.value(error).pipe(
                      Match.tag("HyperliquidInternalError", () => true),
                      Match.orElse(() => false),
                    ),
                }),
                Effect.timeout("30 seconds"),
                Effect.catchTag("TimeoutError", () =>
                  Effect.fail(
                    new HyperliquidInternalError({
                      message: "Exchange leverage update timed out",
                      endpoint: "exchange.updateLeverage()",
                      symbol: params.symbol,
                    }),
                  ),
                ),
              );
            }),
        ),

      cancelOrders: (params, userId) =>
        withExchangeClient(
          userId,
          accountRepo,
          credentialRepo,
          metaCache,
          ({ exchange, vaultAddress, coinToAsset }) =>
            Effect.gen(function* () {
              const cancels: Array<{ a: number; o: number }> = [];
              for (const c of params.cancels) {
                const a = coinToAsset.get(c.symbol);
                if (a === undefined) {
                  return yield* Effect.fail(
                    new HyperliquidInternalError({
                      message: `Unknown coin: ${c.symbol}`,
                      symbol: c.symbol,
                    }),
                  );
                }
                cancels.push({ a, o: c.orderId });
              }

              const cancelOpts = vaultAddress ? { vaultAddress } : {};
              return yield* Effect.tryPromise({
                try: () => exchange.cancel({ cancels }, cancelOpts),
                catch: classifyExchangeError,
              }).pipe(
                Effect.retry({
                  schedule: Schedule.exponential("200 millis").pipe(Schedule.take(3)),
                  while: (error) =>
                    Match.value(error).pipe(
                      Match.tag("HyperliquidInternalError", () => true),
                      Match.orElse(() => false),
                    ),
                }),
                Effect.timeout("30 seconds"),
                Effect.catchTag("TimeoutError", () =>
                  Effect.fail(
                    new HyperliquidInternalError({
                      message: "Exchange cancel timed out",
                      endpoint: "exchange.cancel()",
                    }),
                  ),
                ),
              );
            }),
        ),
    });
  }),
);
