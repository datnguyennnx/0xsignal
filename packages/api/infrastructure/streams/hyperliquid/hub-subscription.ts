import { Match } from "effect";
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

export async function subscribeUpstream(
  bucket: Bucket,
  subscriptionClient: SubscriptionClient,
  aggregatedMarketsPromise: Promise<readonly HyperliquidAggregatedAsset[]> | undefined,
  detach: (ws: ServerWebSocket<MarketWsConnectionData>) => void
): Promise<ISubscription> {
  const { subscription } = bucket;
  let internalSymbol = subscription.symbol;
  const subSymbol = subscription.symbol;

  if (aggregatedMarketsPromise && subSymbol) {
    try {
      const markets = await aggregatedMarketsPromise;
      if (markets) {
        const subUpper = subSymbol.toUpperCase();
        const asset: HyperliquidAggregatedAsset | undefined = markets.find(
          (m) => m.rawCoin === subSymbol || m.rawCoin.toUpperCase() === subUpper
        );
        if (!asset) {
          throw new WebSocketSubscribeError({
            message: `Cannot subscribe to WebSocket for "${subSymbol}": not found in any market universe (perp, spot, or outcome).`,
            symbol: subSymbol,
          });
        }
        internalSymbol = asset.marketType === "spot" ? asset.name : asset.rawCoin;
      }
    } catch (error) {
      marketWsLog(
        "symbol_resolution_failed",
        {
          symbol: subSymbol,
          error: error instanceof Error ? error.message : String(error),
        },
        "warn"
      );
      throw error;
    }
  }

  return Match.value(subscription.channel).pipe(
    Match.when("candle", () =>
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
            detach
          );
        }
      )
    ),
    Match.when("l2Book", () =>
      subscriptionClient.l2Book(
        { coin: internalSymbol!, nSigFigs: subscription.nSigFigs },
        (event) => {
          const normalized = normalizeL2BookData(event);
          const levels = normalized.levels as unknown[];
          const maxDepth = (subscription as any).depth ?? 30;
          const sliced = {
            levels: [
              (levels?.[0] as unknown[])?.slice(0, maxDepth) ?? [],
              (levels?.[1] as unknown[])?.slice(0, maxDepth) ?? [],
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
            detach
          );
        }
      )
    ),
    Match.when("trades", () =>
      subscriptionClient.trades({ coin: internalSymbol! }, (event) => {
        broadcast(
          bucket,
          {
            type: "market",
            channel: "trades",
            data: normalizeTradesData(event),
          },
          detach
        );
      })
    ),
    Match.when("allMids", () =>
      subscription.dex
        ? subscriptionClient.allMids({ dex: subscription.dex }, (event) => {
            broadcast(
              bucket,
              {
                type: "market",
                channel: "allMids",
                data: normalizeAllMidsData(event),
              },
              detach
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
              detach
            );
          })
    ),
    Match.exhaustive
  );
}
