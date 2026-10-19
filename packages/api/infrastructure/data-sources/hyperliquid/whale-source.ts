import { Context, Effect, Layer } from "effect";
import { HttpClient } from "effect/unstable/http";
import { HyperliquidClient } from "../../../application/hyperliquid/contracts";
import { WhaleConfig } from "../../config/whale.config";
import {
  WhaleLeaderboard,
  whaleLeaderboardLayer,
  type WhaleLeaderboardProvider,
} from "./whale-leaderboard";
import {
  WhalePositionPoller,
  whalePositionPollerLayer,
  type WhalePositionPollerProvider,
} from "./whale-position-poller";
import {
  WhaleTradeStream,
  whaleTradeStreamLayer,
  type WhaleTradeStreamProvider,
} from "./whale-trade-stream";

/** Every upstream a whale ingest pass can read from. */
export type WhaleSourceProvider =
  | {
      readonly kind: "trade-stream";
      readonly stream: WhaleTradeStreamProvider;
    }
  | {
      readonly kind: "position-poller";
      readonly poller: WhalePositionPollerProvider;
    }
  | {
      readonly kind: "leaderboard";
      readonly leaderboard: WhaleLeaderboardProvider;
    };

export class WhaleSources extends Context.Service<WhaleSources, readonly WhaleSourceProvider[]>()(
  "WhaleSources",
) {}

/**
 * Bundles the live trade-stream provider, the REST position poller and the
 * REST leaderboard. Construction opens no fibers and hits no network; the
 * ingest loop and any polling schedule are started by the whale layer.
 */
export const WhaleSourcesLayer: Layer.Layer<
  WhaleSources,
  never,
  HyperliquidClient | WhaleConfig | HttpClient.HttpClient
> = Layer.effect(
  WhaleSources,
  Effect.gen(function* () {
    const stream = yield* WhaleTradeStream;
    const poller = yield* WhalePositionPoller;
    const leaderboard = yield* WhaleLeaderboard;
    return WhaleSources.of([
      { kind: "trade-stream", stream },
      { kind: "position-poller", poller },
      { kind: "leaderboard", leaderboard },
    ]);
  }),
).pipe(
  Layer.provide(
    Layer.mergeAll(whaleTradeStreamLayer, whalePositionPollerLayer, whaleLeaderboardLayer),
  ),
);
