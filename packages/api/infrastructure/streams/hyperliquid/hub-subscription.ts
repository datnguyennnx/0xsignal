import { Effect, Match } from "effect";
import { SubscriptionClient, TransportError } from "@nktkas/hyperliquid";
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

/**
 * Merge fast (5-level, 0.5s) and slow (20-level, 5s) orderbook levels
 * into a single combined snapshot. Fast levels are more up-to-date and
 * take precedence over slow levels at the same price. Slow levels fill
 * in deeper book positions beyond the fast 5.
 *
 * @returns merged levels sliced to maxDepth
 */
function mergeL2Levels(
  fast: readonly [unknown[], unknown[]],
  slow: readonly [unknown[], unknown[]],
  maxDepth: number,
): [unknown[], unknown[]] {
  return [
    mergeLevelSide(fast[0], slow[0], maxDepth, false), // bids: descending price
    mergeLevelSide(fast[1], slow[1], maxDepth, true), // asks: ascending price
  ];
}

/**
 * Merge one side (bids or asks) from fast and slow snapshots.
 * Fast levels overwrite slow at the same price. Result is sorted
 * and sliced to maxDepth.
 */
function mergeLevelSide(
  fast: readonly unknown[],
  slow: readonly unknown[],
  maxDepth: number,
  ascending: boolean,
): unknown[] {
  const map = new Map<string, { px: string; sz: string; n: number }>();

  // Insert slow first (provides deep book)
  for (let i = 0; i < slow.length; i++) {
    const level = slow[i] as { px: string; sz: string; n: number };
    map.set(level.px, level);
  }

  // Insert fast second — overwrites slow at same price with fresher data
  for (let i = 0; i < fast.length; i++) {
    const level = fast[i] as { px: string; sz: string; n: number };
    map.set(level.px, level);
  }

  // Sort by price: descending for bids, ascending for asks
  const sorted = [...map.values()].sort((a, b) => {
    return ascending ? parseFloat(a.px) - parseFloat(b.px) : parseFloat(b.px) - parseFloat(a.px);
  });

  return sorted.slice(0, maxDepth);
}

export function subscribeUpstream(
  bucket: Bucket,
  subscriptionClient: SubscriptionClient,
  aggregatedMarketsPromise: Promise<readonly HyperliquidAggregatedAsset[]> | undefined,
  detach: (ws: ServerWebSocket<MarketWsConnectionData>) => void,
  onSubscriptionError?: (error: TransportError) => void,
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
                {
                  onError: (error: TransportError) => {
                    marketWsLog(
                      "upstream_subscription_error",
                      { bucketKey: bucket.key, channel: "candle", error: error.message },
                      "error",
                    );
                    onSubscriptionError?.(error);
                  },
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
            try: () => {
              const coin = internalSymbol!;
              const nSigFigs = subscription.nSigFigs ?? null;
              const maxDepth = subscription.depth ?? 20;

              // Shared mutable state for the hybrid subscription
              const fastSnapshot: { current: [unknown[], unknown[]] | null } = { current: null };
              const slowSnapshot: { current: [unknown[], unknown[]] | null } = { current: null };
              const combinedSnapshot: {
                current: { levels: [unknown[], unknown[]] } | null;
              } = { current: null };

              /**
               * Merge the latest fast and slow snapshots, then broadcast
               * snapshot or delta to all clients.
               */
              const mergeAndBroadcast = () => {
                if (!fastSnapshot.current || !slowSnapshot.current) return;

                const merged = mergeL2Levels(fastSnapshot.current, slowSnapshot.current, maxDepth);

                if (!combinedSnapshot.current) {
                  // First merged snapshot — emit full snapshot
                  combinedSnapshot.current = { levels: merged };
                  broadcast(
                    bucket,
                    {
                      type: "market",
                      channel: "l2Book",
                      nSigFigs,
                      data: { snapshot: { levels: merged } },
                    },
                    detach,
                  );
                } else {
                  // Compute delta against current combined snapshot
                  const prev = combinedSnapshot.current;
                  const delta = computeL2BookDelta(prev, { levels: merged });

                  if (delta.replace) {
                    // >50% of visible levels changed — broadcast full snapshot replacement
                    broadcast(
                      bucket,
                      {
                        type: "market",
                        channel: "l2Book",
                        nSigFigs,
                        data: { snapshot: { levels: merged } },
                      },
                      detach,
                    );
                  } else if (delta.changedBids.length > 0 || delta.changedAsks.length > 0) {
                    // Partial change — send delta for incremental update
                    broadcast(
                      bucket,
                      {
                        type: "market",
                        channel: "l2Book",
                        nSigFigs,
                        data: { delta },
                      },
                      detach,
                    );
                  }

                  // Update combined snapshot in-place
                  combinedSnapshot.current.levels = merged;
                }
              };

              const onError = (error: TransportError) => {
                marketWsLog(
                  "upstream_subscription_error",
                  { bucketKey: bucket.key, channel: "l2Book", error: error.message },
                  "error",
                );
                onSubscriptionError?.(error);
              };

              // Subscribe to fast (5 levels, 0.5s) — captures near-spread levels
              const fastPromise = subscriptionClient.l2Book(
                { coin, nSigFigs, fast: true },
                (event) => {
                  // Guard: server dispatches ALL l2Book events to ALL listeners
                  // on the same channel. Only accept events tagged as fast.
                  if (!event.fast) return;
                  const rawLevels = normalizeL2BookData(event).levels;
                  fastSnapshot.current = [
                    Array.isArray(rawLevels?.[0]) ? rawLevels[0] : [],
                    Array.isArray(rawLevels?.[1]) ? rawLevels[1] : [],
                  ] as [unknown[], unknown[]];
                  mergeAndBroadcast();
                },
                { onError },
              );

              // Subscribe to slow (20 levels, 5s) — provides full depth
              const slowPromise = subscriptionClient.l2Book(
                { coin, nSigFigs, fast: false },
                (event) => {
                  // Guard: server dispatches ALL l2Book events to ALL listeners
                  // on the same channel. Only accept events NOT tagged as fast.
                  if (event.fast) return;
                  const rawLevels = normalizeL2BookData(event).levels;
                  slowSnapshot.current = [
                    Array.isArray(rawLevels?.[0]) ? rawLevels[0] : [],
                    Array.isArray(rawLevels?.[1]) ? rawLevels[1] : [],
                  ] as [unknown[], unknown[]];
                  mergeAndBroadcast();
                },
                { onError },
              );

              // Return composite subscription that unsubscribes both.
              // Subscribe sequentially: if slow fails, fast is cleaned up.
              return fastPromise.then((fastSub) =>
                slowPromise
                  .then((slowSub) => ({
                    unsubscribe: () =>
                      Promise.allSettled([fastSub.unsubscribe(), slowSub.unsubscribe()]).then(
                        () => {},
                      ),
                  }))
                  .catch((e: unknown) => {
                    // Fast subscribed but slow failed — clean up fast to avoid leak
                    fastSub.unsubscribe().catch(() => {});
                    throw e;
                  }),
              );
            },
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
              subscriptionClient.trades(
                { coin: internalSymbol! },
                (event) => {
                  broadcast(
                    bucket,
                    {
                      type: "market",
                      channel: "trades",
                      data: normalizeTradesData(event),
                    },
                    detach,
                  );
                },
                {
                  onError: (error: TransportError) => {
                    marketWsLog(
                      "upstream_subscription_error",
                      { bucketKey: bucket.key, channel: "trades", error: error.message },
                      "error",
                    );
                    onSubscriptionError?.(error);
                  },
                },
              ),
            catch: (error) =>
              new WebSocketSubscribeError({
                message: `Failed to subscribe to trades: ${error instanceof Error ? error.message : String(error)}`,
                symbol: subSymbol,
              }),
          }),
        ),
        Match.when("allMids", () =>
          Effect.tryPromise({
            try: () => {
              const subFn = subscription.dex
                ? (
                    listener: (event: unknown) => void,
                    options?: { onError?: (error: TransportError) => void },
                  ) => subscriptionClient.allMids({ dex: subscription.dex }, listener, options)
                : (
                    listener: (event: unknown) => void,
                    options?: { onError?: (error: TransportError) => void },
                  ) => subscriptionClient.allMids(listener, options);

              return subFn(
                (event) => {
                  broadcast(
                    bucket,
                    {
                      type: "market",
                      channel: "allMids",
                      data: normalizeAllMidsData(event),
                    },
                    detach,
                  );
                },
                {
                  onError: (error: TransportError) => {
                    marketWsLog(
                      "upstream_subscription_error",
                      { bucketKey: bucket.key, channel: "allMids", error: error.message },
                      "error",
                    );
                    onSubscriptionError?.(error);
                  },
                },
              );
            },
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

/**
 * Reusable Map for delta computation to avoid GC pressure on every tick.
 * Safe because all calls are serial on the same event loop (single subscription callback).
 */
const deltaMap = new Map<string, { px: string; sz: string; n: number }>();

/**
 * Compute an L2 orderbook delta between two snapshots.
 * Returns only the levels that changed (price, size changes or new levels).
 * If >50% of visible levels changed, sends a full snapshot replacement marker.
 *
 * Optimized for zero GC allocation in the common case (few changed levels).
 * Reuses a single Map across calls instead of allocating per tick.
 */
function computeL2BookDelta(
  prev: { levels: readonly [unknown[], unknown[]] },
  curr: { levels: readonly [unknown[], unknown[]] },
): {
  changedBids: readonly unknown[];
  changedAsks: readonly unknown[];
  replace: boolean;
} {
  const changedBids = computeLevelChanges(prev.levels[0], curr.levels[0]);
  const changedAsks = computeLevelChanges(prev.levels[1], curr.levels[1]);

  const totalBids = Math.max(prev.levels[0].length, 1);
  const totalAsks = Math.max(prev.levels[1].length, 1);
  const changeRatio = (changedBids.length / totalBids + changedAsks.length / totalAsks) / 2;

  return {
    changedBids,
    changedAsks,
    replace: changeRatio > 0.5,
  };
}

/**
 * Compute which levels changed between two level arrays.
 * Reuses a shared Map to avoid per-call GC pressure.
 * O(n) — single pass per array.
 */
function computeLevelChanges(
  prev: readonly unknown[],
  curr: readonly unknown[],
): readonly unknown[] {
  // Early exit — no prev data
  if (prev.length === 0) {
    return curr.slice() as unknown[];
  }

  deltaMap.clear();

  // Index prev levels by price
  for (let i = 0; i < prev.length; i++) {
    const level = prev[i] as { px: string; sz: string; n: number };
    deltaMap.set(level.px, level);
  }

  const changed: unknown[] = [];

  // Compare current levels against prev — single pass
  for (let i = 0; i < curr.length; i++) {
    const level = curr[i] as { px: string; sz: string; n: number };
    const prevLevel = deltaMap.get(level.px);
    if (!prevLevel || prevLevel.sz !== level.sz) {
      changed.push(level);
    }
    deltaMap.delete(level.px);
  }

  // Remaining entries in the map are deleted levels — include with sz="0"
  if (deltaMap.size > 0) {
    for (const [, level] of deltaMap) {
      changed.push({ px: level.px, sz: "0", n: 0 });
    }
  }

  return changed;
}
