import { Effect, Layer, Predicate, Stream } from "effect";
import { HttpClient } from "effect/http";
import { HyperliquidClient } from "./hyperliquid-client";
import {
  WhaleSources,
  type WhaleSourceError,
  type WhaleSourceKind,
  WhaleSourceRateLimitedError,
  WhaleSourceUnavailableError,
} from "../../../modules/whales";
import { WhaleConfig } from "../../../modules/whales";
import { WhaleLeaderboard, whaleLeaderboardLayer } from "./whale-leaderboard";
import { WhalePositionPoller, whalePositionPollerLayer } from "./whale-position-poller";
import { WhaleTradeStream, whaleTradeStreamLayer } from "./whale-trade-stream";
import type { HyperliquidRateLimiter } from "../rate-limit";

/**
 * The adapter input: any tagged upstream failure with a message. The adapter
 * narrows on the tag so the port keeps distinct tags instead of a bare message.
 */
type TaggedUpstreamFailure = {
  readonly _tag: string;
  readonly message: string;
  readonly kind?: string | undefined;
};

export const toWhaleSourceError =
  (source: WhaleSourceKind) =>
  (error: TaggedUpstreamFailure): WhaleSourceError =>
    Predicate.isTagged(error, "RateLimitBudgetExhaustedError") ||
    (Predicate.isTagged(error, "HyperliquidError") && error.kind === "RATE_LIMITED")
      ? new WhaleSourceRateLimitedError({ message: error.message, source, cause: error })
      : new WhaleSourceUnavailableError({ message: error.message, source, cause: error });

/**
 * Bundles the live trade-stream provider, the REST position poller and the
 * REST leaderboard. Construction opens no fibers and hits no network; the
 * ingest loop and any polling schedule are started by the whale layer.
 */
export const WhaleSourcesLayer: Layer.Layer<
  WhaleSources,
  never,
  HyperliquidClient | WhaleConfig | HttpClient.HttpClient | HyperliquidRateLimiter
> = Layer.effect(
  WhaleSources,
  Effect.gen(function* () {
    const stream = yield* WhaleTradeStream;
    const poller = yield* WhalePositionPoller;
    const leaderboard = yield* WhaleLeaderboard;
    return WhaleSources.of([
      {
        kind: "trade-stream",
        stream: {
          trades: () => stream.trades().pipe(Stream.mapError(toWhaleSourceError("trade-stream"))),
        },
      },
      {
        kind: "position-poller",
        poller: {
          pollPositions: (addresses) =>
            poller
              .pollPositions(addresses)
              .pipe(Effect.mapError(toWhaleSourceError("position-poller"))),
        },
      },
      {
        kind: "leaderboard",
        leaderboard: {
          fetchLeaderboard: () =>
            leaderboard.fetchLeaderboard().pipe(Effect.mapError(toWhaleSourceError("leaderboard"))),
        },
      },
    ]);
  }),
).pipe(
  Layer.provide(
    Layer.mergeAll(whaleTradeStreamLayer, whalePositionPollerLayer, whaleLeaderboardLayer),
  ),
);
