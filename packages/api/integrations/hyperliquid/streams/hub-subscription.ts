/// <reference lib="es2023.array" />
import { Effect, Match, Option } from "effect";
import type { SubscriptionHandle, WsClient } from "@0xsignal/sdk-hyperliquid/subscription";
import type { HyperliquidAggregatedAsset } from "../data-sources/types";
import { asRecord, isUnknownArray } from "../../../shared/parsing";
import { normalizeAllMidsData, normalizeCandleData, normalizeL2BookData } from "./normalizers";
import { broadcast } from "./hub-broadcast";
import {
  type Bucket,
  type L2BookLevel,
  type L2BookSnapshotFrame,
  type MarketWsConnectionData,
  WebSocketSubscribeError,
} from "./hub-types";
import type { ServerWebSocket } from "bun";
import { marketWsLog } from "./logging";

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

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

const isL2Level = (value: unknown): value is L2BookLevel => {
  const record = asRecord(value);
  return (
    record !== null &&
    typeof record.px === "string" &&
    typeof record.sz === "string" &&
    typeof record.n === "number"
  );
};

const sideLevels = (value: unknown): L2BookLevel[] =>
  isUnknownArray(value) ? value.filter((level) => isL2Level(level)) : [];

const toBookLevels = (levels: unknown[]): [L2BookLevel[], L2BookLevel[]] => [
  sideLevels(levels[0]),
  sideLevels(levels[1]),
];

const emitL2BookSnapshot = (
  resolveBucket: ResolveBucket,
  frame: L2BookSnapshotFrame,
  detach: (ws: ServerWebSocket<MarketWsConnectionData>) => void,
): void => {
  const current = resolveBucket();
  if (current === undefined) return;
  current.lastSnapshot.current = Option.some(frame);
  broadcast(current, frame, detach);
};

export function subscribeUpstream(
  bucket: Bucket,
  ws: WsClient,
  aggregatedMarketsPromise: Promise<readonly HyperliquidAggregatedAsset[]> | undefined,
  detach: (ws: ServerWebSocket<MarketWsConnectionData>) => void,
  resolveBucket: ResolveBucket,
  onSubscriptionError?: (message: string) => void,
): Effect.Effect<SubscriptionHandle, WebSocketSubscribeError> {
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
        const asset: HyperliquidAggregatedAsset | undefined = markets.find((m) =>
          [m.rawCoin, m.coin, m.name].some(
            (key) => key === symbol || key.toUpperCase() === subUpper,
          ),
        );
        if (!asset) {
          return Effect.fail(
            new WebSocketSubscribeError({
              message: `Cannot subscribe to WebSocket for "${symbol}": not found in any market universe (perp, spot, or outcome) by rawCoin, coin, or name.`,
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
          Effect.try({
            try: () =>
              ws.subscribe(
                { type: "candle", coin: internalSymbol!, interval: subscription.interval! },
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
                  onError: (error) => {
                    const message = errorMessage(error);
                    marketWsLog(
                      "upstream_subscription_error",
                      { bucketKey: bucket.key, channel: "candle", error: message },
                      "error",
                    );
                    onSubscriptionError?.(message);
                  },
                },
              ),
            catch: (error) =>
              new WebSocketSubscribeError({
                message: `Failed to subscribe to candle: ${errorMessage(error)}`,
                symbol: subSymbol,
              }),
          }),
        ),
        Match.when("l2Book", () =>
          Effect.try({
            try: () => {
              const coin = internalSymbol!;
              const nSigFigs = subscription.nSigFigs ?? null;
              const maxDepth = subscription.depth ?? 20;

              return ws.subscribe(
                { type: "l2Book", coin, nSigFigs },
                (event) => {
                  const [bids, asks] = toBookLevels(normalizeL2BookData(event).levels);
                  emitL2BookSnapshot(
                    resolveBucket,
                    {
                      type: "market",
                      channel: "l2Book",
                      nSigFigs,
                      data: {
                        snapshot: {
                          levels: [bids.slice(0, maxDepth), asks.slice(0, maxDepth)],
                        },
                      },
                    },
                    detach,
                  );
                },
                {
                  onError: (error) => {
                    const message = errorMessage(error);
                    marketWsLog(
                      "upstream_subscription_error",
                      { bucketKey: bucket.key, channel: "l2Book", error: message },
                      "error",
                    );
                    onSubscriptionError?.(message);
                  },
                },
              );
            },
            catch: (error) =>
              new WebSocketSubscribeError({
                message: `Failed to subscribe to l2Book: ${errorMessage(error)}`,
                symbol: subSymbol,
              }),
          }),
        ),
        Match.when("allMids", () =>
          Effect.try({
            try: () => {
              const dex = subscription.dex;
              const target =
                dex !== undefined && dex !== ""
                  ? ({ type: "allMids", dex } as const)
                  : ({ type: "allMids" } as const);

              return ws.subscribe(
                target,
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
                  onError: (error) => {
                    const message = errorMessage(error);
                    marketWsLog(
                      "upstream_subscription_error",
                      { bucketKey: bucket.key, channel: "allMids", error: message },
                      "error",
                    );
                    onSubscriptionError?.(message);
                  },
                },
              );
            },
            catch: (error) =>
              new WebSocketSubscribeError({
                message: `Failed to subscribe to allMids: ${errorMessage(error)}`,
                symbol: subSymbol,
              }),
          }),
        ),
        Match.exhaustive,
      ),
    ),
  );
}
