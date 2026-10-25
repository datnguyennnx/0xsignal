/// <reference lib="es2023.array" />
import { Effect, Match } from "effect";
import { SubscriptionClient, TransportError } from "@nktkas/hyperliquid";
import type { ISubscription } from "@nktkas/hyperliquid";
import type { HyperliquidAggregatedAsset } from "../data-sources/types";
import { asRecord, isUnknownArray } from "../../../shared/parsing";
import { normalizeAllMidsData, normalizeCandleData, normalizeL2BookData } from "./normalizers";
import { broadcast } from "./hub-broadcast";
import { type Bucket, type MarketWsConnectionData, WebSocketSubscribeError } from "./hub-types";
import type { ServerWebSocket } from "bun";
import { marketWsLog } from "./logging";

type ResolveBucket = () => Bucket | undefined;

/**
 * Resolve the bucket from the Ref at emit time. A join replaces the bucket
 * object, so a bucket captured when the upstream subscribed goes stale and
 * every client that joined afterwards would never receive a frame.
 * A missing bucket means the last client left: drop the frame.
 */
const emitToLatest = (
  resolveBucket: ResolveBucket,
  payload: unknown,
  detach: (ws: ServerWebSocket<MarketWsConnectionData>) => void,
): void => {
  const current = resolveBucket();
  if (current === undefined) return;
  broadcast(current, payload, detach);
};

interface L2Level {
  readonly px: string;
  readonly sz: string;
  readonly n: number;
}

const isL2Level = (value: unknown): value is L2Level => {
  const record = asRecord(value);
  return (
    record !== null &&
    typeof record.px === "string" &&
    typeof record.sz === "string" &&
    typeof record.n === "number"
  );
};

const sideLevels = (value: unknown): L2Level[] =>
  isUnknownArray(value) ? value.filter((level) => isL2Level(level)) : [];

const toBookLevels = (levels: unknown[]): [L2Level[], L2Level[]] => [
  sideLevels(levels[0]),
  sideLevels(levels[1]),
];

/**
 * Merge fast (5-level, 0.5s) and slow (20-level, 5s) orderbook levels
 * into a single combined snapshot. Fast levels are more up-to-date and
 * take precedence over slow levels at the same price. Slow levels fill
 * in deeper book positions beyond the fast 5.
 *
 * @returns merged levels sliced to maxDepth
 */
function mergeL2Levels(
  fast: readonly [L2Level[], L2Level[]],
  slow: readonly [L2Level[], L2Level[]],
  maxDepth: number,
): [L2Level[], L2Level[]] {
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
  fast: readonly L2Level[],
  slow: readonly L2Level[],
  maxDepth: number,
  ascending: boolean,
): L2Level[] {
  const map = new Map<string, L2Level>();

  // Insert slow first (provides deep book)
  for (const level of slow) {
    map.set(level.px, level);
  }

  // Insert fast second — overwrites slow at same price with fresher data
  for (const level of fast) {
    map.set(level.px, level);
  }

  // Sort by price: descending for bids, ascending for asks
  const sorted = [...map.values()].toSorted((a, b) => {
    return ascending ? Number(a.px) - Number(b.px) : Number(b.px) - Number(a.px);
  });

  return sorted.slice(0, maxDepth);
}

export function subscribeUpstream(
  bucket: Bucket,
  subscriptionClient: SubscriptionClient,
  aggregatedMarketsPromise: Promise<readonly HyperliquidAggregatedAsset[]> | undefined,
  detach: (ws: ServerWebSocket<MarketWsConnectionData>) => void,
  resolveBucket: ResolveBucket,
  onSubscriptionError?: (error: TransportError) => void,
): Effect.Effect<ISubscription, WebSocketSubscribeError> {
  const { subscription } = bucket;
  let internalSymbol = subscription.symbol;
  const subSymbol = subscription.symbol;

  const resolveSymbol = (): Effect.Effect<void, WebSocketSubscribeError> => {
    const symbol = subSymbol;
    if (aggregatedMarketsPromise === undefined || symbol === undefined || symbol === "") {
      return Effect.void;
    }

    return Effect.tryPromise({
      try: () => aggregatedMarketsPromise,
      catch: (error) =>
        new WebSocketSubscribeError({
          message: `Failed to resolve markets for "${symbol}": ${error instanceof Error ? error.message : String(error)}`,
          symbol,
        }),
    }).pipe(
      Effect.flatMap((markets) => {
        const subUpper = symbol.toUpperCase();
        const asset: HyperliquidAggregatedAsset | undefined = markets.find(
          (m) => m.rawCoin === symbol || m.rawCoin.toUpperCase() === subUpper,
        );
        if (!asset) {
          return Effect.fail(
            new WebSocketSubscribeError({
              message: `Cannot subscribe to WebSocket for "${symbol}": not found in any market universe (perp, spot, or outcome).`,
              symbol,
            }),
          );
        }
        internalSymbol = asset.marketType === "spot" ? asset.name : asset.rawCoin;
        return Effect.void;
      }),
      Effect.tapError((error) =>
        Effect.sync(() => {
          marketWsLog(
            "symbol_resolution_failed",
            {
              symbol,
              error: error instanceof Error ? error.message : String(error),
            },
            "warn",
          );
        }),
      ),
    );
  };

  return resolveSymbol().pipe(
    Effect.flatMap(() =>
      Match.value(subscription.channel).pipe(
        Match.when("candle", () =>
          Effect.tryPromise({
            try: () =>
              subscriptionClient.candle(
                { coin: internalSymbol!, interval: subscription.interval! },
                (event) => {
                  emitToLatest(
                    resolveBucket,
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
              const fastSnapshot: { current: [L2Level[], L2Level[]] | null } = { current: null };
              const slowSnapshot: { current: [L2Level[], L2Level[]] | null } = { current: null };
              const combinedSnapshot: {
                current: { levels: [L2Level[], L2Level[]] } | null;
              } = { current: null };
              // Scratch space owned by this subscription so two l2Book buckets
              // can never interleave their delta computation.
              const deltaScratch = new Map<string, L2Level>();

              /**
               * Merge the latest fast and slow snapshots, then broadcast
               * snapshot or delta to all clients.
               */
              const mergeAndBroadcast = () => {
                if (!fastSnapshot.current || !slowSnapshot.current) return;

                const merged = mergeL2Levels(fastSnapshot.current, slowSnapshot.current, maxDepth);

                if (combinedSnapshot.current) {
                  // Compute delta against current combined snapshot
                  const prev = combinedSnapshot.current;
                  const delta = computeL2BookDelta(prev, { levels: merged }, deltaScratch);

                  if (delta.replace) {
                    // >50% of visible levels changed — broadcast full snapshot replacement
                    emitToLatest(
                      resolveBucket,
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
                    emitToLatest(
                      resolveBucket,
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
                } else {
                  // First merged snapshot — emit full snapshot
                  combinedSnapshot.current = { levels: merged };
                  emitToLatest(
                    resolveBucket,
                    {
                      type: "market",
                      channel: "l2Book",
                      nSigFigs,
                      data: { snapshot: { levels: merged } },
                    },
                    detach,
                  );
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

              // Subscribe one leg at a time: a failing fast leg must not leave
              // an unawaited slow leg behind.
              const subscribeLegs = async (): Promise<ISubscription> => {
                const fastSub = await subscriptionClient.l2Book(
                  { coin, nSigFigs, fast: true },
                  (event) => {
                    // Guard: server dispatches ALL l2Book events to ALL listeners
                    // on the same channel. Only accept events tagged as fast.
                    if (!event.fast) return;
                    fastSnapshot.current = toBookLevels(normalizeL2BookData(event).levels);
                    mergeAndBroadcast();
                  },
                  { onError },
                );

                try {
                  const slowSub = await subscriptionClient.l2Book(
                    { coin, nSigFigs, fast: false },
                    (event) => {
                      // Guard: server dispatches ALL l2Book events to ALL listeners
                      // on the same channel. Only accept events NOT tagged as fast.
                      if (event.fast) return;
                      slowSnapshot.current = toBookLevels(normalizeL2BookData(event).levels);
                      mergeAndBroadcast();
                    },
                    { onError },
                  );

                  return {
                    unsubscribe: async () => {
                      await Promise.allSettled([fastSub.unsubscribe(), slowSub.unsubscribe()]);
                    },
                  };
                } catch (error) {
                  // Fast subscribed but slow failed — clean up fast to avoid leak
                  await Promise.allSettled([fastSub.unsubscribe()]);
                  throw error;
                }
              };

              return subscribeLegs();
            },
            catch: (error) =>
              new WebSocketSubscribeError({
                message: `Failed to subscribe to l2Book: ${error instanceof Error ? error.message : String(error)}`,
                symbol: subSymbol,
              }),
          }),
        ),
        Match.when("allMids", () =>
          Effect.tryPromise({
            try: () => {
              const dex = subscription.dex;
              const subFn =
                dex !== undefined && dex !== ""
                  ? (
                      listener: (event: unknown) => void,
                      options?: { onError?: (error: TransportError) => void },
                    ) => subscriptionClient.allMids({ dex }, listener, options)
                  : (
                      listener: (event: unknown) => void,
                      options?: { onError?: (error: TransportError) => void },
                    ) => subscriptionClient.allMids(listener, options);

              return subFn(
                (event) => {
                  emitToLatest(
                    resolveBucket,
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
 * Compute an L2 orderbook delta between two snapshots.
 * Returns only the levels that changed (price, size changes or new levels).
 * If >50% of visible levels changed, sends a full snapshot replacement marker.
 *
 * Optimized for zero GC allocation in the common case (few changed levels):
 * the caller passes a scratch Map that is reused across ticks.
 */
function computeL2BookDelta(
  prev: { levels: readonly [L2Level[], L2Level[]] },
  curr: { levels: readonly [L2Level[], L2Level[]] },
  scratch: Map<string, L2Level>,
): {
  changedBids: readonly L2Level[];
  changedAsks: readonly L2Level[];
  replace: boolean;
} {
  const changedBids = computeLevelChanges(prev.levels[0], curr.levels[0], scratch);
  const changedAsks = computeLevelChanges(prev.levels[1], curr.levels[1], scratch);

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
 * Reuses the caller's scratch Map to avoid per-call GC pressure.
 * O(n) — single pass per array.
 */
function computeLevelChanges(
  prev: readonly L2Level[],
  curr: readonly L2Level[],
  scratch: Map<string, L2Level>,
): readonly L2Level[] {
  // Early exit — no prev data
  if (prev.length === 0) {
    return curr.slice();
  }

  scratch.clear();

  // Index prev levels by price
  for (const level of prev) {
    scratch.set(level.px, level);
  }

  const changed: L2Level[] = [];

  // Compare current levels against prev — single pass
  for (const level of curr) {
    const prevLevel = scratch.get(level.px);
    if (!prevLevel || prevLevel.sz !== level.sz) {
      changed.push(level);
    }
    scratch.delete(level.px);
  }

  // Remaining entries in the map are deleted levels — include with sz="0"
  if (scratch.size > 0) {
    for (const [, level] of scratch) {
      changed.push({ px: level.px, sz: "0", n: 0 });
    }
  }

  return changed;
}
