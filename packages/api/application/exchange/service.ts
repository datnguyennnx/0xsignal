import { Clock, Effect, Layer, Ref } from "effect";
import type { ExchangeClient, InfoClient } from "@nktkas/hyperliquid";
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
  metaCache: Ref.Ref<{
    readonly value?: { universe: Array<{ name: string }> };
    readonly expiresAt: number;
  }>,
  info: InfoClient,
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

    const meta = yield* getCachedMetaInner(metaCache, info);
    const coinToAsset = buildCoinToAsset(meta);

    return yield* fn({ exchange, vaultAddress, coinToAsset });
  });

const getCachedMetaInner = (
  metaCache: Ref.Ref<{
    readonly value?: { universe: Array<{ name: string }> };
    readonly expiresAt: number;
  }>,
  info: InfoClient,
): Effect.Effect<{ universe: Array<{ name: string }> }, HyperliquidInternalError> =>
  Effect.gen(function* () {
    const cached = yield* Ref.get(metaCache);
    const now = yield* Clock.currentTimeMillis;
    if (cached.value !== undefined && cached.expiresAt > now) {
      return cached.value;
    }
    const value = yield* Effect.tryPromise({
      try: () => info.meta(),
      catch: (e) =>
        new HyperliquidInternalError({
          message: "Failed to fetch market metadata",
          cause: e,
        }),
    });
    yield* Ref.set(metaCache, {
      value,
      expiresAt: now + 300_000,
    });
    return value;
  });

export const exchangeServiceLayer = Layer.effect(
  ExchangeService,
  Effect.gen(function* () {
    const { info } = yield* HyperliquidClient;
    const accountRepo = yield* ExchangeAccountRepo;
    const credentialRepo = yield* ExchangeCredentialRepo;

    const metaCache = yield* Ref.make<{
      readonly value?: { universe: Array<{ name: string }> };
      readonly expiresAt: number;
    }>({ expiresAt: 0 });

    return ExchangeService.of({
      placeOrder: (params, userId) =>
        withExchangeClient(
          userId,
          accountRepo,
          credentialRepo,
          metaCache,
          info,
          ({ exchange, vaultAddress, coinToAsset }) =>
            Effect.gen(function* () {
              const hlOrders = yield* Effect.forEach(params.orders, (o) =>
                Effect.gen(function* () {
                  const a = coinToAsset.get(o.symbol);
                  if (a === undefined) {
                    return yield* Effect.fail(
                      new HyperliquidInternalError({ message: `Unknown coin: ${o.symbol}` }),
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
                Effect.timeout("30 seconds"),
                Effect.catchTag("TimeoutError", () =>
                  Effect.fail(
                    new HyperliquidInternalError({ message: "Exchange order timed out" }),
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
          info,
          ({ exchange, vaultAddress, coinToAsset }) =>
            Effect.gen(function* () {
              const assetIndex = coinToAsset.get(params.symbol);
              if (assetIndex === undefined) {
                return yield* Effect.fail(
                  new HyperliquidInternalError({ message: `Unknown coin: ${params.symbol}` }),
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
                Effect.timeout("30 seconds"),
                Effect.catchTag("TimeoutError", () =>
                  Effect.fail(
                    new HyperliquidInternalError({ message: "Exchange leverage update timed out" }),
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
          info,
          ({ exchange, vaultAddress, coinToAsset }) =>
            Effect.gen(function* () {
              const cancels: Array<{ a: number; o: number }> = [];
              for (const c of params.cancels) {
                const a = coinToAsset.get(c.symbol);
                if (a === undefined) {
                  return yield* Effect.fail(
                    new HyperliquidInternalError({ message: `Unknown coin: ${c.symbol}` }),
                  );
                }
                cancels.push({ a, o: c.orderId });
              }

              const cancelOpts = vaultAddress ? { vaultAddress } : {};
              return yield* Effect.tryPromise({
                try: () => exchange.cancel({ cancels }, cancelOpts),
                catch: (e) =>
                  new HyperliquidInternalError({ message: "Failed to cancel orders", cause: e }),
              }).pipe(
                Effect.timeout("30 seconds"),
                Effect.catchTag("TimeoutError", () =>
                  Effect.fail(
                    new HyperliquidInternalError({ message: "Exchange cancel timed out" }),
                  ),
                ),
              );
            }),
        ),
    });
  }),
);
