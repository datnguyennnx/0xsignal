import { Config, Effect, Layer, Option } from "effect";
import {
  ExchangeClient,
  HttpTransport,
  ValidationError,
  HttpRequestError,
  TransportError,
} from "@nktkas/hyperliquid";
import { ApiRequestError } from "@nktkas/hyperliquid/api/exchange";
import { privateKeyToAccount } from "viem/accounts";
import { ValiError } from "valibot";
import { HyperliquidClient } from "../../infrastructure/data-sources/hyperliquid/client";
import { ExchangeServices } from "./contracts";
import {
  HyperliquidInternalError,
  HyperliquidValidationError,
  InsufficientMarginError,
} from "../../domain/errors";

const resolvePrivateKey = () =>
  Config.option(Config.string("HYPERLIQUID_PRIVATE_KEY")).pipe(
    Config.map((maybeKey) => {
      const raw = Option.getOrElse(maybeKey, () => "").trim();
      if (!raw) {
        console.error("[exchange] HYPERLIQUID_PRIVATE_KEY is not configured");
        return null;
      }
      // Ensure 0x prefix and correct length (0x + 64 hex chars = 66)
      const key = raw.startsWith("0x") ? raw : `0x${raw}`;
      const hex = key.startsWith("0x") ? key.slice(2) : key;
      if (hex.length !== 64 || !/^[0-9a-fA-F]+$/.test(hex)) {
        console.error("[exchange] HYPERLIQUID_PRIVATE_KEY is invalid (expected 64 hex chars)");
        return null;
      }
      return key as `0x${string}`;
    })
  );

const makeExchangeClient = (privateKey: `0x${string}`): ExchangeClient => {
  const wallet = privateKeyToAccount(privateKey);
  const transport = new HttpTransport();
  return new ExchangeClient({ transport, wallet });
};

/** Classify a caught error from an SDK call into a typed DomainError. */
const classifyExchangeError = (
  e: unknown
): HyperliquidValidationError | InsufficientMarginError | HyperliquidInternalError => {
  // ── SDK client-side payload validation failure ──
  if (e instanceof ValiError) {
    return new HyperliquidValidationError({ message: e.message, cause: e });
  }
  if (e instanceof ValidationError) {
    return new HyperliquidValidationError({ message: e.message, cause: e.cause });
  }

  // ── Exchange API rejection (actionable) ──
  if (e instanceof ApiRequestError) {
    const msg = e.message.toLowerCase();
    if (msg.includes("insufficient margin")) {
      return new InsufficientMarginError({ message: e.message });
    }
    if (msg.includes("invalid") || msg.includes("size") || msg.includes("tick")) {
      return new HyperliquidValidationError({ message: e.message, cause: e });
    }
    return new HyperliquidInternalError({ message: e.message, cause: e });
  }

  // ── Transport / network failures (retryable, non-actionable) ──
  if (e instanceof HttpRequestError || e instanceof TransportError) {
    return new HyperliquidInternalError({ message: e.message, cause: e });
  }

  // ── Completely unknown ──
  const fallbackMsg = e instanceof Error ? e.message : String(e);
  return new HyperliquidInternalError({
    message: fallbackMsg,
    cause: e instanceof Error ? e : undefined,
  });
};

export const ExchangeServicesLive = Layer.effect(
  ExchangeServices,
  Effect.gen(function* () {
    const privateKey = yield* resolvePrivateKey();
    const { info } = yield* HyperliquidClient;

    if (!privateKey) {
      const err = new HyperliquidInternalError({
        message: "HYPERLIQUID_PRIVATE_KEY is not configured",
        cause: null,
      });
      return ExchangeServices.of({
        placeOrder: () => Effect.fail(err),
        updateLeverageAndMargin: () => Effect.fail(err),
        cancelOrders: () => Effect.fail(err),
      });
    }

    const exchange = makeExchangeClient(privateKey);

    return ExchangeServices.of({
      placeOrder: (params) =>
        Effect.tryPromise({
          try: async () => {
            // Normalize payload: coerce types before hitting the SDK
            const payload = {
              orders: params.orders.map((o) => ({
                a: Number(o.a),
                b: Boolean(o.b),
                p: String(o.p),
                s: String(o.s),
                r: Boolean(o.r),
                t: o.t,
              })),
              grouping: params.grouping ?? "na",
            };
            return exchange.order(payload);
          },
          catch: classifyExchangeError,
        }),

      updateLeverageAndMargin: (params) =>
        Effect.tryPromise({
          try: () =>
            exchange.updateLeverage({
              asset: Number(params.asset),
              isCross: Boolean(params.isCross),
              leverage: Number(params.leverage),
            }),
          catch: classifyExchangeError,
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
            const a = coinToAsset.get(c.coin);
            if (a === undefined) {
              return yield* Effect.fail(
                new HyperliquidInternalError({ message: `Unknown coin: ${c.coin}` })
              );
            }
            cancels.push({ a, o: c.o });
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
