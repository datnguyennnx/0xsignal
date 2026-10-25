import { describe, expect, it, vi } from "vitest";
import { Effect, Layer, Predicate } from "effect";
import { HttpTransport, InfoClient } from "@nktkas/hyperliquid";
import type { ClearinghouseState } from "@0xsignal/shared";
import { HyperliquidClient } from "../hyperliquid-client";
import { WhaleConfig, type WhaleConfigService } from "../../../../modules/whales";
import {
  HyperliquidRateLimiter,
  RateLimitBudgetExhaustedError,
  layerUnlimited,
  makeLimiter,
} from "../../rate-limit";
import { WhalePositionPoller, whalePositionPollerLayer } from "../whale-position-poller";

const config: WhaleConfigService = {
  whaleNotionalUsd: 0,
  coinUniverse: [],
  discoveryNotionalUsd: 0,
  pollIntervalMs: 5_000,
  maxWalletsPerPoll: 10,
  walletTtlMs: 60_000,
  leaderboardUrl: "http://localhost",
  leaderboardTtlMs: 0,
  seededWalletCap: 10,
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
      // Weight 2 can never fit a per-minute ceiling of 1.
      Layer.effect(HyperliquidRateLimiter, makeLimiter({ perSecond: 20, perMinute: 1 })),
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

const createMockInfoClient = () => ({
  allMids: vi.fn<InfoClient["allMids"]>(),
  clearinghouseState: vi.fn<InfoClient["clearinghouseState"]>(),
});

const layerWith = (info: InfoClient) =>
  whalePositionPollerLayer.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(HyperliquidClient, HyperliquidClient.of({ info })),
        Layer.succeed(WhaleConfig, config),
        layerUnlimited,
      ),
    ),
  );

const clearinghouseState = (position: {
  coin: string;
  szi: string;
  entryPx: string;
  positionValue: string;
}): ClearinghouseState => ({
  marginSummary: { accountValue: "0", totalNtlPos: "0", totalRawUsd: "0", totalMarginUsed: "0" },
  crossMarginSummary: {
    accountValue: "0",
    totalNtlPos: "0",
    totalRawUsd: "0",
    totalMarginUsed: "0",
  },
  crossMaintenanceMarginUsed: "0",
  withdrawable: "0",
  assetPositions: [
    {
      type: "oneWay",
      position: {
        ...position,
        leverage: { type: "cross", value: 10 },
        unrealizedPnl: "1500",
        returnOnEquity: "0.1",
        liquidationPx: null,
        marginUsed: "2500",
        maxLeverage: 50,
        cumFunding: { allTime: "0", sinceOpen: "0", sinceChange: "0" },
      },
    },
  ],
  time: 1_700_000_000_000,
});

describe("whale position poller valuation", () => {
  it("fails the tick when allMids is rate limited instead of valuing at entry price", async () => {
    const mock = createMockInfoClient();
    mock.allMids.mockRejectedValue(
      Object.assign(new Error("429 Too Many Requests"), { status: 429 }),
    );
    mock.clearinghouseState.mockResolvedValue(
      clearinghouseState({ coin: "BTC", szi: "10", entryPx: "100", positionValue: "25000" }),
    );

    const program = Effect.gen(function* () {
      const poller = yield* WhalePositionPoller;
      return yield* poller.pollPositions(["0xwallet"]);
    });

    const error = await Effect.runPromise(
      Effect.provide(
        program,
        layerWith(Object.assign(new InfoClient({ transport: new HttpTransport() }), mock)),
      ).pipe(Effect.flip),
    );

    expect(error).toEqual(
      expect.objectContaining({ _tag: "HyperliquidError", kind: "RATE_LIMITED" }),
    );
    // A failed mark fetch must abort before any position is valued.
    expect(mock.clearinghouseState).not.toHaveBeenCalled();
  });

  it("omits markPrice and does not fabricate notional from entry price when a mark is absent", async () => {
    const mock = createMockInfoClient();
    mock.allMids.mockResolvedValue({ ETH: "3000" });
    mock.clearinghouseState.mockResolvedValue(
      clearinghouseState({ coin: "BTC", szi: "10", entryPx: "100", positionValue: "25000" }),
    );

    const result = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* () {
          const poller = yield* WhalePositionPoller;
          return yield* poller.pollPositions(["0xwallet"]);
        }),
        layerWith(Object.assign(new InfoClient({ transport: new HttpTransport() }), mock)),
      ),
    );

    const entryPricedNotionalUsd = 10 * 100;
    expect(result.positions).toHaveLength(1);
    const position = result.positions[0];
    expect(position?.markPrice).toBeUndefined();
    expect(position?.notionalUsd).toBe(25_000);
    expect(position?.notionalUsd).not.toBe(entryPricedNotionalUsd);
  });
});
