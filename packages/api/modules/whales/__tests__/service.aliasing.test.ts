import { describe, expect, it } from "vitest";
import { Deferred, Effect, Fiber, Layer, Stream } from "effect";
import type { WhaleTrade } from "@0xsignal/shared";
import { WhaleService } from "../index";
import { WhaleConfig, type WhaleConfigService } from "../config";
import { WhaleRepo, type WhalePositionsPage } from "../repo";
import { WhaleSources } from "../sources";
import { whaleServiceLayer } from "../layer";

const SEED_WALLET = "0xseed";
const TRADE_WALLET = "0xtrade";

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

const trade = (user: string): WhaleTrade => ({
  tid: `tid-${user}`,
  user,
  coin: "BTC",
  side: "buy",
  px: "100",
  sz: "1",
  notionalUsd: 1_000_000,
  time: new Date(0).toISOString(),
});

type Harness = {
  readonly layer: Layer.Layer<WhaleService>;
  readonly polls: string[][];
  readonly reached: Deferred.Deferred<void>;
  readonly release: Deferred.Deferred<void>;
};

const makeHarness = (): Harness => {
  const polls: string[][] = [];
  const reached = Deferred.makeUnsafe<void>();
  const release = Deferred.makeUnsafe<void>();
  let pollCalls = 0;
  let streamCalls = 0;

  const repoLayer = Layer.succeed(WhaleRepo, {
    upsertPositions: () => Effect.succeed(0),
    deleteClosedPositions: () => Effect.succeed(0),
    queryPositions: () => Effect.succeed<WhalePositionsPage>({ positions: [], nextCursor: null }),
    deletePositionsForAddresses: () => Effect.succeed(0),
    pruneStalePositions: () => Effect.succeed(0),
  });

  const sourcesLayer = Layer.succeed(WhaleSources, [
    {
      kind: "trade-stream" as const,
      stream: {
        trades: () => {
          streamCalls += 1;
          return streamCalls === 2 ? Stream.make(trade(TRADE_WALLET)) : Stream.empty;
        },
      },
    },
    {
      kind: "position-poller" as const,
      poller: {
        pollPositions: (addresses: string[]) =>
          Effect.gen(function* () {
            pollCalls += 1;
            if (pollCalls === 1) {
              Deferred.doneUnsafe(reached, Effect.void);
              yield* Deferred.await(release);
            }
            polls.push([...addresses]);
            return { positions: [], succeededAddresses: addresses };
          }),
      },
    },
    {
      kind: "leaderboard" as const,
      leaderboard: {
        fetchLeaderboard: () => Effect.succeed([{ ethAddress: SEED_WALLET, accountValue: 500 }]),
      },
    },
  ]);

  const layer = whaleServiceLayer.pipe(
    Layer.provideMerge(Layer.mergeAll(repoLayer, sourcesLayer, Layer.succeed(WhaleConfig, config))),
  );

  return { layer, polls, reached, release };
};

const nth = <A>(values: readonly A[], index: number): A => {
  const value = values[index];
  if (value === undefined) throw new Error(`missing value at index ${index}`);
  return value;
};

describe("whale discovery tracked-wallet aliasing", () => {
  it("keeps a previously read tracked map an independent snapshot", async () => {
    const harness = makeHarness();

    const program = Effect.gen(function* () {
      const service = yield* WhaleService;
      const firstTick = yield* Effect.forkChild(service.discoverAndRefreshPositions());

      // Wait until the first tick holds its snapshot and is about to poll.
      yield* Deferred.await(harness.reached);

      // A second tick nominates a new wallet while the first tick is parked.
      yield* service.discoverAndRefreshPositions();

      Deferred.doneUnsafe(harness.release, Effect.void);
      yield* Fiber.join(firstTick);
    });

    await Effect.runPromise(program.pipe(Effect.provide(harness.layer)));

    expect(harness.polls).toHaveLength(2);
    const parkedTickAddresses = nth(harness.polls, 1);
    expect(parkedTickAddresses).toContain(SEED_WALLET);
    expect(parkedTickAddresses).not.toContain(TRADE_WALLET);
  });
});
