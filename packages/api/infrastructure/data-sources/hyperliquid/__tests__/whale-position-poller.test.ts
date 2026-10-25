import { describe, expect, it } from "vitest";
import { Effect, Layer, Predicate } from "effect";
import { HttpTransport, InfoClient } from "@nktkas/hyperliquid";
import { HyperliquidClient } from "../../../../application/hyperliquid/contracts";
import {
  WhaleConfig,
  type WhaleConfigService,
} from "../../../../application/whales/config.contracts";
import {
  RateLimitBudgetExhaustedError,
  WhalePositionPoller,
  whalePositionPollerLayer,
} from "../whale-position-poller";

const config: WhaleConfigService = {
  whaleNotionalUsd: 0,
  coinUniverse: [],
  discoveryNotionalUsd: 0,
  pollIntervalMs: 5_000,
  maxWalletsPerPoll: 10,
  walletTtlMs: 60_000,
  // Each call costs weight 2, so this budget cannot ever grant a call.
  restWeightBudgetPerMin: 1,
  leaderboardUrl: "http://localhost",
  leaderboardTtlMs: 0,
  seededWalletCap: 10,
  walletRetentionMs: 60_000,
  positionRetentionMs: 60_000,
};

const layer = whalePositionPollerLayer.pipe(
  Layer.provide(
    Layer.mergeAll(
      Layer.succeed(
        HyperliquidClient,
        HyperliquidClient.of({ info: new InfoClient({ transport: new HttpTransport() }) }),
      ),
      Layer.succeed(WhaleConfig, config),
    ),
  ),
);

describe("whale position poller token bucket", () => {
  it("fails with the tagged error when the budget is below the request weight", async () => {
    const program = Effect.gen(function* () {
      const poller = yield* WhalePositionPoller;
      return yield* poller
        .pollPositions(["0xwallet"])
        .pipe(Effect.flip, Effect.timeout("1 second"));
    });

    const error = await Effect.runPromise(Effect.provide(program, layer));

    expect(error instanceof RateLimitBudgetExhaustedError).toBe(true);
    expect(Predicate.isTagged(error, "RateLimitBudgetExhaustedError")).toBe(true);
  });
});
