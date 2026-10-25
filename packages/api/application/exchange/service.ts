import { Cache, Duration, Effect, Layer } from "effect";
import type { ExchangeClient } from "@nktkas/hyperliquid";
import { HyperliquidClient } from "../hyperliquid/contracts";
import { ExchangeService, type ExchangeError } from "./contracts";
import { ExchangeCredentials } from "./credentials.contracts";
import { HyperliquidInternalError, HyperliquidValidationError } from "../../domain/errors";
import { classifyExchangeError, toHlTif } from "./error-classification";
import { buildCoinToAsset } from "./asset-index";

const MARKET_TIME_IN_FORCE: ReadonlySet<string> = new Set(["FrontendMarket", "Market"]);

const withExchangeClient = <A>(
  userId: string,
  credentials: typeof ExchangeCredentials.Service,
  metaCache: Cache.Cache<string, { universe: Array<{ name: string }> }, HyperliquidInternalError>,
  fn: (ctx: {
    exchange: ExchangeClient;
    vaultAddress: string | undefined;
    coinToAsset: Map<string, number>;
  }) => Effect.Effect<A, ExchangeError>,
): Effect.Effect<A, ExchangeError> =>
  Effect.gen(function* () {
    const { exchange, vaultAddress } = yield* credentials.resolve(userId);

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
    const credentials = yield* ExchangeCredentials;

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
          credentials,
          metaCache,
          ({ exchange, vaultAddress, coinToAsset }) =>
            Effect.gen(function* () {
              const hlOrders = yield* Effect.forEach(params.orders, (o) =>
                Effect.gen(function* () {
                  const zeroPrice = Number(o.price) === 0;
                  const marketClose =
                    o.reduceOnly &&
                    o.orderType.kind === "limit" &&
                    MARKET_TIME_IN_FORCE.has(o.orderType.timeInForce);
                  if (zeroPrice && !marketClose) {
                    return yield* Effect.fail(
                      new HyperliquidValidationError({
                        message: "price must be > 0 unless closing with a market order",
                        symbol: o.symbol,
                        input: { price: o.price, reduceOnly: o.reduceOnly },
                      }),
                    );
                  }

                  const a = coinToAsset.get(o.symbol);
                  if (a === undefined) {
                    return yield* Effect.fail(
                      new HyperliquidValidationError({
                        message: `Symbol not supported on Hyperliquid: ${o.symbol}`,
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
                        ? ({
                            limit: { tif: yield* toHlTif(o.orderType.timeInForce) },
                          } as const)
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

              const orderOpts =
                vaultAddress === undefined || vaultAddress === "" ? {} : { vaultAddress };
              return yield* Effect.tryPromise({
                try: () =>
                  exchange.order(
                    { orders: hlOrders, grouping: params.grouping ?? "na" },
                    orderOpts,
                  ),
                catch: classifyExchangeError,
              }).pipe(
                // No retry on submit: without an idempotency key a timeout cannot tell
                // "already sent" from "never sent", so a retry risks a duplicate order.
                Effect.timeout("30 seconds"),
                Effect.catchTag("TimeoutError", () =>
                  Effect.fail(
                    new HyperliquidInternalError({
                      message: "Exchange order outcome unknown: timed out",
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
          credentials,
          metaCache,
          ({ exchange, vaultAddress, coinToAsset }) =>
            Effect.gen(function* () {
              const assetIndex = coinToAsset.get(params.symbol);
              if (assetIndex === undefined) {
                return yield* Effect.fail(
                  new HyperliquidValidationError({
                    message: `Symbol not supported on Hyperliquid: ${params.symbol}`,
                    symbol: params.symbol,
                  }),
                );
              }

              const leverageOpts =
                vaultAddress === undefined || vaultAddress === "" ? {} : { vaultAddress };
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
                // No retry: a timed-out leverage update may already have applied.
                Effect.timeout("30 seconds"),
                Effect.catchTag("TimeoutError", () =>
                  Effect.fail(
                    new HyperliquidInternalError({
                      message: "Exchange leverage update outcome unknown: timed out",
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
          credentials,
          metaCache,
          ({ exchange, vaultAddress, coinToAsset }) =>
            Effect.gen(function* () {
              const cancels: Array<{ a: number; o: number }> = [];
              for (const c of params.cancels) {
                const a = coinToAsset.get(c.symbol);
                if (a === undefined) {
                  return yield* Effect.fail(
                    new HyperliquidValidationError({
                      message: `Symbol not supported on Hyperliquid: ${c.symbol}`,
                      symbol: c.symbol,
                    }),
                  );
                }
                cancels.push({ a, o: c.orderId });
              }

              const cancelOpts =
                vaultAddress === undefined || vaultAddress === "" ? {} : { vaultAddress };
              return yield* Effect.tryPromise({
                try: () => exchange.cancel({ cancels }, cancelOpts),
                catch: classifyExchangeError,
              }).pipe(
                // No retry: a timed-out cancel may already have been applied.
                Effect.timeout("30 seconds"),
                Effect.catchTag("TimeoutError", () =>
                  Effect.fail(
                    new HyperliquidInternalError({
                      message: "Exchange cancel outcome unknown: timed out",
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
