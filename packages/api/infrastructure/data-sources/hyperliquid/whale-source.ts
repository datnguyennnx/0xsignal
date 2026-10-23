import { Effect, Layer } from "effect";
import { HttpClient } from "effect/unstable/http";
import { HyperliquidClient } from "../../../application/hyperliquid/contracts";
import { WhaleSources } from "../../../application/whales/sources.contracts";
import { WhaleConfig } from "../../config/whale.config";
import { WhaleLeaderboard, whaleLeaderboardLayer } from "./whale-leaderboard";
import { WhalePositionPoller, whalePositionPollerLayer } from "./whale-position-poller";
import { WhaleTradeStream, whaleTradeStreamLayer } from "./whale-trade-stream";

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
