import { Config, Effect, Layer, Option } from "effect";
import { ExchangeClient, HttpTransport } from "@nktkas/hyperliquid";
import { privateKeyToAccount } from "viem/accounts";
import { HyperliquidClient } from "../../infrastructure/data-sources/hyperliquid/client";
import { ExchangeService } from "./contracts";
import { HyperliquidInternalError } from "../../domain/errors";
import {
  classifyExchangeError,
  toHlTif,
} from "../../infrastructure/data-sources/hyperliquid/exchange-adapter";

const validatePrivateKey = (raw: string): `0x${string}` | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const key = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  const hex = key.startsWith("0x") ? key.slice(2) : key;
  if (hex.length !== 64 || !/^[0-9a-fA-F]+$/.test(hex)) return null;
  return key as `0x${string}`;
};

const makeExchangeClient = (privateKey: `0x${string}`): ExchangeClient => {
  const wallet = privateKeyToAccount(privateKey);
  const transport = new HttpTransport();
  return new ExchangeClient({ transport, wallet });
};

export const exchangeServiceLayer = Layer.effect(
  ExchangeService,
  Effect.gen(function* () {
    const maybeKey = yield* Config.option(Config.string("HYPERLIQUID_PRIVATE_KEY"));
    const { info } = yield* HyperliquidClient;

    const rawKey = Option.getOrElse(maybeKey, () => "");
    const privateKey = validatePrivateKey(rawKey);

    if (!privateKey) {
      yield* Effect.logError("[exchange] HYPERLIQUID_PRIVATE_KEY is not configured or invalid");
      const err = new HyperliquidInternalError({
        message: "HYPERLIQUID_PRIVATE_KEY is not configured",
        cause: null,
      });
      return ExchangeService.of({
        placeOrder: () => Effect.fail(err),
        updateLeverageAndMargin: () => Effect.fail(err),
        cancelOrders: () => Effect.fail(err),
      });
    }

    const exchange = makeExchangeClient(privateKey);

    return ExchangeService.of({
      placeOrder: (params) =>
        Effect.gen(function* () {
          const meta = yield* Effect.tryPromise({
            try: () => info.meta(),
            catch: (e) =>
              new HyperliquidInternalError({
                message: "Failed to fetch market metadata",
                cause: e,
              }),
          });

          const coinToAsset = new Map<string, number>(
            meta.universe.map((u: { name: string }, i: number) => [u.name, i])
          );

          const hlOrders = params.orders.map((o) => {
            const a = coinToAsset.get(o.symbol);
            if (a === undefined) {
              throw new HyperliquidInternalError({ message: `Unknown coin: ${o.symbol}` });
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
          });

          return yield* Effect.tryPromise({
            try: () => exchange.order({ orders: hlOrders, grouping: params.grouping ?? "na" }),
            catch: classifyExchangeError,
          });
        }),

      updateLeverageAndMargin: (params) =>
        Effect.gen(function* () {
          const meta = yield* Effect.tryPromise({
            try: () => info.meta(),
            catch: (e) =>
              new HyperliquidInternalError({
                message: "Failed to fetch market metadata",
                cause: e,
              }),
          });

          const coinToAsset = new Map<string, number>(
            meta.universe.map((u: { name: string }, i: number) => [u.name, i])
          );

          const assetIndex = coinToAsset.get(params.symbol);
          if (assetIndex === undefined) {
            return yield* Effect.fail(
              new HyperliquidInternalError({ message: `Unknown coin: ${params.symbol}` })
            );
          }

          return yield* Effect.tryPromise({
            try: () =>
              exchange.updateLeverage({
                asset: assetIndex,
                isCross: params.isCross,
                leverage: params.leverage,
              }),
            catch: classifyExchangeError,
          });
        }),

      cancelOrders: (params) =>
        Effect.gen(function* () {
          const meta = yield* Effect.tryPromise({
            try: () => info.meta(),
            catch: (e) =>
              new HyperliquidInternalError({
                message: "Failed to fetch market metadata",
                cause: e,
              }),
          });

          const coinToAsset = new Map<string, number>(
            meta.universe.map((u: { name: string }, i: number) => [u.name, i])
          );

          const cancels: Array<{ a: number; o: number }> = [];
          for (const c of params.cancels) {
            const a = coinToAsset.get(c.symbol);
            if (a === undefined) {
              return yield* Effect.fail(
                new HyperliquidInternalError({ message: `Unknown coin: ${c.symbol}` })
              );
            }
            cancels.push({ a, o: c.orderId });
          }

          return yield* Effect.tryPromise({
            try: () => exchange.cancel({ cancels }),
            catch: (e) =>
              new HyperliquidInternalError({ message: "Failed to cancel orders", cause: e }),
          });
        }),
    });
  })
);
