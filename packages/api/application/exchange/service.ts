import { Clock, Effect, Layer, Ref, Redacted } from "effect";
import { ExchangeClient, HttpTransport } from "@nktkas/hyperliquid";
import { privateKeyToAccount } from "viem/accounts";
import { HyperliquidClient } from "../../infrastructure/data-sources/hyperliquid/client";
import { ExchangeService } from "./contracts";
import { HyperliquidInternalError } from "../../domain/errors";
import {
  classifyExchangeError,
  toHlTif,
} from "../../infrastructure/data-sources/hyperliquid/exchange-adapter";
import { ExchangeAccountRepo } from "@0xsignal/auth";
import { ExchangeCredentialRepo } from "@0xsignal/auth";

const validatePrivateKey = (raw: string): `0x${string}` | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const key = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  const hex = key.startsWith("0x") ? key.slice(2) : key;
  if (hex.length !== 64 || !/^[0-9a-fA-F]+$/.test(hex)) return null;
  return key as `0x${string}`;
};

const buildCoinToAsset = (meta: { universe: Array<{ name: string }> }): Map<string, number> =>
  new Map(meta.universe.map((u: { name: string }, i: number) => [u.name, i]));

const makeExchangeClient = (privateKey: `0x${string}`): ExchangeClient => {
  const wallet = privateKeyToAccount(privateKey);
  const transport = new HttpTransport();
  return new ExchangeClient({ transport, wallet });
};

export const exchangeServiceLayer = Layer.effect(
  ExchangeService,
  Effect.gen(function* () {
    const { info } = yield* HyperliquidClient;
    const accountRepo = yield* ExchangeAccountRepo;
    const credentialRepo = yield* ExchangeCredentialRepo;

    // 5 min TTL cache
    const metaCache = yield* Ref.make<{
      readonly value?: { universe: Array<{ name: string }> };
      readonly expiresAt: number;
    }>({ expiresAt: 0 });

    const getCachedMeta = (): Effect.Effect<
      { universe: Array<{ name: string }> },
      HyperliquidInternalError
    > =>
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

    return ExchangeService.of({
      placeOrder: (params, userId) =>
        Effect.gen(function* () {
          const account = yield* accountRepo.findPrimary(userId, "hyperliquid");
          const credential = yield* credentialRepo.getActiveForAccount(account.id, "agent");
          const decrypted = yield* credentialRepo.getDecryptedAgent(credential.id, userId);

          const rawKey = Redacted.value(decrypted.privateKey);
          const privateKey = validatePrivateKey(rawKey);
          if (!privateKey) {
            return yield* Effect.fail(
              new HyperliquidInternalError({
                message: "Invalid decrypted private key from credential store",
              })
            );
          }
          const exchange = makeExchangeClient(privateKey);

          const meta = yield* getCachedMeta();
          const coinToAsset = buildCoinToAsset(meta);

          const hlOrders = yield* Effect.forEach(params.orders, (o) =>
            Effect.gen(function* () {
              const a = coinToAsset.get(o.symbol);
              if (a === undefined) {
                return yield* Effect.fail(
                  new HyperliquidInternalError({ message: `Unknown coin: ${o.symbol}` })
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
            })
          );

          const orderOpts = decrypted.vaultAddress ? { vaultAddress: decrypted.vaultAddress } : {};
          return yield* Effect.tryPromise({
            try: () =>
              exchange.order({ orders: hlOrders, grouping: params.grouping ?? "na" }, orderOpts),
            catch: classifyExchangeError,
          }).pipe(
            Effect.timeout("30 seconds"),
            Effect.catchTag("TimeoutError", () =>
              Effect.fail(new HyperliquidInternalError({ message: "Exchange order timed out" }))
            )
          );
        }),

      updateLeverageAndMargin: (params, userId) =>
        Effect.gen(function* () {
          const account = yield* accountRepo.findPrimary(userId, "hyperliquid");
          const credential = yield* credentialRepo.getActiveForAccount(account.id, "agent");
          const decrypted = yield* credentialRepo.getDecryptedAgent(credential.id, userId);
          const rawKey = Redacted.value(decrypted.privateKey);
          const privateKey = validatePrivateKey(rawKey);
          if (!privateKey) {
            return yield* Effect.fail(
              new HyperliquidInternalError({
                message: "Invalid decrypted private key from credential store",
              })
            );
          }
          const exchange = makeExchangeClient(privateKey);

          const meta = yield* getCachedMeta();
          const coinToAsset = buildCoinToAsset(meta);

          const assetIndex = coinToAsset.get(params.symbol);
          if (assetIndex === undefined) {
            return yield* Effect.fail(
              new HyperliquidInternalError({ message: `Unknown coin: ${params.symbol}` })
            );
          }

          const leverageOpts = decrypted.vaultAddress
            ? { vaultAddress: decrypted.vaultAddress }
            : {};
          return yield* Effect.tryPromise({
            try: () =>
              exchange.updateLeverage(
                {
                  asset: assetIndex,
                  isCross: params.isCross,
                  leverage: params.leverage,
                },
                leverageOpts
              ),
            catch: classifyExchangeError,
          }).pipe(
            Effect.timeout("30 seconds"),
            Effect.catchTag("TimeoutError", () =>
              Effect.fail(
                new HyperliquidInternalError({ message: "Exchange leverage update timed out" })
              )
            )
          );
        }),

      cancelOrders: (params, userId) =>
        Effect.gen(function* () {
          const account = yield* accountRepo.findPrimary(userId, "hyperliquid");
          const credential = yield* credentialRepo.getActiveForAccount(account.id, "agent");
          const decrypted = yield* credentialRepo.getDecryptedAgent(credential.id, userId);
          const rawKey = Redacted.value(decrypted.privateKey);
          const privateKey = validatePrivateKey(rawKey);
          if (!privateKey) {
            return yield* Effect.fail(
              new HyperliquidInternalError({
                message: "Invalid decrypted private key from credential store",
              })
            );
          }
          const exchange = makeExchangeClient(privateKey);

          const meta = yield* getCachedMeta();
          const coinToAsset = buildCoinToAsset(meta);

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

          const cancelOpts = decrypted.vaultAddress ? { vaultAddress: decrypted.vaultAddress } : {};
          return yield* Effect.tryPromise({
            try: () => exchange.cancel({ cancels }, cancelOpts),
            catch: (e) =>
              new HyperliquidInternalError({ message: "Failed to cancel orders", cause: e }),
          }).pipe(
            Effect.timeout("30 seconds"),
            Effect.catchTag("TimeoutError", () =>
              Effect.fail(new HyperliquidInternalError({ message: "Exchange cancel timed out" }))
            )
          );
        }),
    });
  })
);
