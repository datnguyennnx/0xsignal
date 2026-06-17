import { Effect, Match } from "effect";
import { SubscriptionClient } from "@nktkas/hyperliquid";
import type { ISubscription } from "@nktkas/hyperliquid";
import type { HyperliquidAggregatedAsset } from "../../data-sources/hyperliquid/types";
import {
  normalizeAllMidsData,
  normalizeCandleData,
  normalizeL2BookData,
  normalizeTradesData,
} from "./normalizers";
import { broadcast } from "./hub-broadcast";
import { type Bucket, type MarketWsConnectionData, WebSocketSubscribeError } from "./hub-types";
import type { ServerWebSocket } from "bun";
import { marketWsLog } from "./logging";

export function subscribeUpstream(
  bucket: Bucket,
  subscriptionClient: SubscriptionClient,
  aggregatedMarketsPromise: Promise<readonly HyperliquidAggregatedAsset[]> | undefined,
  detach: (ws: ServerWebSocket<MarketWsConnectionData>) => void,
): Effect.Effect<ISubscription, WebSocketSubscribeError> {
  const { subscription } = bucket;
  let internalSymbol = subscription.symbol;
  const subSymbol = subscription.symbol;

  const resolveSymbol =
    aggregatedMarketsPromise && subSymbol
      ? Effect.tryPromise({
          try: () => aggregatedMarketsPromise,
          catch: (error) =>
            new WebSocketSubscribeError({
              message: `Failed to resolve markets for "${subSymbol}": ${error instanceof Error ? error.message : String(error)}`,
              symbol: subSymbol,
            }),
        }).pipe(
          Effect.flatMap((markets) => {
            if (!markets) return Effect.succeed(undefined);
            const subUpper = subSymbol.toUpperCase();
            const asset: HyperliquidAggregatedAsset | undefined = markets.find(
              (m) => m.rawCoin === subSymbol || m.rawCoin.toUpperCase() === subUpper,
            );
            if (!asset) {
              return Effect.fail(
                new WebSocketSubscribeError({
                  message: `Cannot subscribe to WebSocket for "${subSymbol}": not found in any market universe (perp, spot, or outcome).`,
                  symbol: subSymbol,
                }),
              );
            }
            internalSymbol = asset.marketType === "spot" ? asset.name : asset.rawCoin;
            return Effect.succeed(undefined);
          }),
          Effect.tapError((error) =>
            Effect.sync(() => {
              marketWsLog(
                "symbol_resolution_failed",
                {
                  symbol: subSymbol,
                  error: error instanceof Error ? error.message : String(error),
                },
                "warn",
              );
            }),
          ),
        )
      : Effect.succeed(undefined);

  return resolveSymbol.pipe(
    Effect.flatMap(() =>
      Match.value(subscription.channel).pipe(
        Match.when("candle", () =>
          Effect.tryPromise({
            try: () =>
              subscriptionClient.candle(
                { coin: internalSymbol!, interval: subscription.interval! },
                (event) => {
                  broadcast(
                    bucket,
                    {
                      type: "market",
                      channel: "candle",
                      interval: subscription.interval,
                      data: normalizeCandleData(event),
                    },
                    detach,
                  );
                },
              ),
            catch: (error) =>
              new WebSocketSubscribeError({
                message: `Failed to subscribe to candle: ${error instanceof Error ? error.message : String(error)}`,
                symbol: subSymbol,
              }),
          }),
        ),
        Match.when("l2Book", () =>
          Effect.tryPromise({
            try: () =>
              subscriptionClient.l2Book(
                { coin: internalSymbol!, nSigFigs: subscription.nSigFigs },
                (event) => {
                  const normalized = normalizeL2BookData(event);
                  const maxDepth = subscription.depth ?? 30;
                  const rawLevels = normalized.levels;
                  const sliced = {
                    levels: [
                      (Array.isArray(rawLevels?.[0]) ? rawLevels[0] : []).slice(0, maxDepth),
                      (Array.isArray(rawLevels?.[1]) ? rawLevels[1] : []).slice(0, maxDepth),
                    ],
                  };
                  broadcast(
                    bucket,
                    {
                      type: "market",
                      channel: "l2Book",
                      nSigFigs: subscription.nSigFigs,
                      data: sliced,
                    },
                    detach,
                  );
                },
              ),
            catch: (error) =>
              new WebSocketSubscribeError({
                message: `Failed to subscribe to l2Book: ${error instanceof Error ? error.message : String(error)}`,
                symbol: subSymbol,
              }),
          }),
        ),
        Match.when("trades", () =>
          Effect.tryPromise({
            try: () =>
              subscriptionClient.trades({ coin: internalSymbol! }, (event) => {
                broadcast(
                  bucket,
                  {
                    type: "market",
                    channel: "trades",
                    data: normalizeTradesData(event),
                  },
                  detach,
                );
              }),
            catch: (error) =>
              new WebSocketSubscribeError({
                message: `Failed to subscribe to trades: ${error instanceof Error ? error.message : String(error)}`,
                symbol: subSymbol,
              }),
          }),
        ),
        Match.when("allMids", () =>
          Effect.tryPromise({
            try: () =>
              subscription.dex
                ? subscriptionClient.allMids({ dex: subscription.dex }, (event) => {
                    broadcast(
                      bucket,
                      {
                        type: "market",
                        channel: "allMids",
                        data: normalizeAllMidsData(event),
                      },
                      detach,
                    );
                  })
                : subscriptionClient.allMids((event) => {
                    broadcast(
                      bucket,
                      {
                        type: "market",
                        channel: "allMids",
                        data: normalizeAllMidsData(event),
                      },
                      detach,
                    );
                  }),
            catch: (error) =>
              new WebSocketSubscribeError({
                message: `Failed to subscribe to allMids: ${error instanceof Error ? error.message : String(error)}`,
                symbol: subSymbol,
              }),
          }),
        ),
        Match.exhaustive,
      ),
    ),
  );
}
