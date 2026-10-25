/// <reference lib="es2023.array" />
import { Clock, Duration, Effect, Ref, Stream } from "effect";
import {
  WHALE_POSITIONS_LIMIT_MAX,
  type WhalePosition,
  type WhalePositionsQuery,
} from "@0xsignal/shared";
import { WhaleRepo, type WhalePositionKey } from "./repo";
import { WhaleConfig } from "./config";
import { WhaleSources, type WhaleSourceProvider } from "./sources";
import { WhaleService, WhaleServiceError } from "./index";

// A discovery tick samples the trade stream for at most this long, so the pass
// stays finite even though the underlying stream never ends.
const DISCOVERY_WINDOW_CAP_MS = 5_000;

const MAX_STORED_POSITION_PAGES = 50;

type TradeStreamSource = Extract<WhaleSourceProvider, { kind: "trade-stream" }>;
type PositionPollerSource = Extract<WhaleSourceProvider, { kind: "position-poller" }>;
type LeaderboardSource = Extract<WhaleSourceProvider, { kind: "leaderboard" }>;

const isTradeStreamSource = (p: WhaleSourceProvider): p is TradeStreamSource =>
  p.kind === "trade-stream";

const isPositionPollerSource = (p: WhaleSourceProvider): p is PositionPollerSource =>
  p.kind === "position-poller";

const isLeaderboardSource = (p: WhaleSourceProvider): p is LeaderboardSource =>
  p.kind === "leaderboard";

const positionKey = (p: { readonly userAddress: string; readonly coin: string }): string =>
  `${p.userAddress}\u0000${p.coin}`;

const positionFingerprint = (p: WhalePosition): string =>
  JSON.stringify([
    p.userAddress,
    p.coin,
    p.side,
    p.size,
    p.notionalUsd,
    p.entryPx,
    p.liquidationPx ?? null,
    p.leverage ?? null,
    p.leverageType ?? null,
    p.marginUsd ?? null,
    p.unrealizedPnl,
    p.unrealizedPnlPct,
    p.fundingFee ?? null,
    p.markPrice ?? null,
    p.entryTime,
  ]);

const mapRepoError =
  (message: string) =>
  (cause: unknown): WhaleServiceError =>
    new WhaleServiceError({ message, cause });

export const makeWhaleService = () =>
  Effect.gen(function* () {
    const repo = yield* WhaleRepo;
    const providers = yield* WhaleSources;

    const stream = providers.find((provider) => isTradeStreamSource(provider));
    if (stream === undefined) {
      return yield* Effect.die(new Error("WhaleSources must bundle a trade-stream provider"));
    }

    const poller = providers.find((provider) => isPositionPollerSource(provider));
    if (poller === undefined) {
      return yield* Effect.die(new Error("WhaleSources must bundle a position-poller provider"));
    }

    const leaderboard = providers.find((provider) => isLeaderboardSource(provider));
    if (leaderboard === undefined) {
      return yield* Effect.die(new Error("WhaleSources must bundle a leaderboard provider"));
    }

    const config = yield* WhaleConfig;

    // Tracked wallet => last nomination. Retained across passes so a wallet
    // discovered in one tick stays polled on later ticks until its TTL expires.
    const tracked = yield* Ref.make(
      new Map<string, { readonly lastSeenAt: number; readonly lastNotionalUsd: number }>(),
    );

    // Primary discovery source: the official leaderboard. The top wallets by
    // account value are seeded into the tracked set so a fresh run is never
    // empty, even before any trade-tape nomination arrives. `accountValue`
    // stands in as the notional until the tape or poll supplies a real one.
    const seedFromLeaderboard = (): Effect.Effect<void, WhaleServiceError> =>
      Effect.gen(function* () {
        const rows = yield* leaderboard.leaderboard
          .fetchLeaderboard()
          .pipe(Effect.mapError(mapRepoError("Failed to fetch the whale leaderboard")));

        const cap = Math.max(0, config.seededWalletCap);
        const seeded = rows.toSorted((a, b) => b.accountValue - a.accountValue).slice(0, cap);
        if (seeded.length === 0) return;

        const now = yield* Clock.currentTimeMillis;
        yield* Ref.update(tracked, (map) => {
          const next = new Map(map);
          for (const row of seeded) {
            next.set(row.ethAddress, { lastSeenAt: now, lastNotionalUsd: row.accountValue });
          }
          return next;
        });
      });

    const loadStoredPositions = (): Effect.Effect<readonly WhalePosition[], WhaleServiceError> =>
      Effect.gen(function* () {
        const all: WhalePosition[] = [];
        let cursor: string | undefined;
        for (let page = 0; page < MAX_STORED_POSITION_PAGES; page++) {
          const query: WhalePositionsQuery =
            cursor === undefined
              ? { limit: WHALE_POSITIONS_LIMIT_MAX }
              : { cursor, limit: WHALE_POSITIONS_LIMIT_MAX };
          const res = yield* repo
            .queryPositions(query)
            .pipe(Effect.mapError(mapRepoError("Failed to load stored whale positions")));
          all.push(...res.positions);
          const next = res.nextCursor;
          if (
            res.positions.length === 0 ||
            next === undefined ||
            next === null ||
            next.length === 0
          ) {
            break;
          }
          cursor = next;
        }
        return all;
      });

    return WhaleService.of({
      // One finite, repeatable discovery tick: seed wallets from the official
      // leaderboard, then sample the trade stream for a bounded window, then
      // persist the tracked wallets and reconcile their stored positions
      // against a fresh poll.
      discoverAndRefreshPositions: () =>
        Effect.gen(function* () {
          const windowMs = Math.max(1, Math.min(config.pollIntervalMs, DISCOVERY_WINDOW_CAP_MS));

          // A leaderboard outage must not abort the tick: the trade tape and
          // position poll still carry discovery for already-tracked wallets.
          yield* seedFromLeaderboard().pipe(
            Effect.catch((error) =>
              Effect.logWarning(`[whale] leaderboard seed failed, continuing: ${error.message}`),
            ),
          );

          yield* stream.stream.trades().pipe(
            Stream.filter((trade) => trade.notionalUsd >= config.discoveryNotionalUsd),
            Stream.tap((trade) =>
              // Copy-on-write: a tick parked on an earlier snapshot must not
              // see wallets nominated after that snapshot.
              Effect.gen(function* () {
                const seenAt = yield* Clock.currentTimeMillis;
                yield* Ref.update(tracked, (map) =>
                  new Map(map).set(trade.user, {
                    lastSeenAt: seenAt,
                    lastNotionalUsd: trade.notionalUsd,
                  }),
                );
              }),
            ),
            Stream.runDrain,
            Effect.mapError(mapRepoError("Failed to consume the whale trade stream for discovery")),
            Effect.timeoutOption(Duration.millis(windowMs)),
            Effect.catch((error) =>
              Effect.logWarning(
                `[whale] trade stream discovery failed, continuing: ${error.message}`,
              ),
            ),
          );

          const now = yield* Clock.currentTimeMillis;
          // The sweep drops expired wallets from memory; their addresses are
          // returned so their stored positions can be reclaimed in the DB.
          const dropped = yield* Ref.modify(tracked, (map) => {
            const expired: string[] = [];
            const next = new Map(map);
            for (const [address, meta] of next) {
              if (now - meta.lastSeenAt > config.walletTtlMs) {
                next.delete(address);
                expired.push(address);
              }
            }
            return [expired, next] as const;
          });

          if (dropped.length > 0) {
            yield* repo.deletePositionsForAddresses(dropped).pipe(
              Effect.mapError(mapRepoError("Failed to delete positions for expired whale wallets")),
              Effect.catch((error) =>
                Effect.logWarning(
                  `[whale] expired-wallet position cleanup failed, continuing: ${error.message}`,
                ),
              ),
            );
          }

          // Retention is best-effort: a prune outage must not abort the tick.
          yield* repo.pruneWallets(new Date(now - config.walletRetentionMs)).pipe(
            Effect.mapError(mapRepoError("Failed to prune stale whale wallets")),
            Effect.catch((error) =>
              Effect.logWarning(`[whale] wallet prune failed, continuing: ${error.message}`),
            ),
          );

          yield* repo.pruneStalePositions(new Date(now - config.positionRetentionMs)).pipe(
            Effect.mapError(mapRepoError("Failed to prune stale whale positions")),
            Effect.catch((error) =>
              Effect.logWarning(`[whale] position prune failed, continuing: ${error.message}`),
            ),
          );

          const trackedNow = yield* Ref.get(tracked);
          if (trackedNow.size === 0) return;

          const walletInputs = Array.from(trackedNow, ([address, meta]) => ({
            address,
            lastTradeAt: new Date(meta.lastSeenAt).toISOString(),
            lastNotionalUsd: meta.lastNotionalUsd,
          }));
          yield* repo
            .upsertWallets(walletInputs)
            .pipe(Effect.mapError(mapRepoError("Failed to upsert whale wallets")));

          const addresses = Array.from(trackedNow.entries())
            .toSorted((a, b) => b[1].lastSeenAt - a[1].lastSeenAt)
            .slice(0, Math.max(0, config.maxWalletsPerPoll))
            .map(([address]) => address);

          const freshResult = yield* poller.poller
            .pollPositions(addresses)
            .pipe(Effect.mapError(mapRepoError("Failed to poll whale positions")));
          const fresh = freshResult.positions;

          const stored = yield* loadStoredPositions();

          const freshByKey = new Map(fresh.map((position) => [positionKey(position), position]));
          // Only successfully-fetched addresses are reconciled: a wallet whose
          // fetch failed keeps its stored rows untouched this tick.
          const succeeded = new Set(freshResult.succeededAddresses);
          const storedByKey = new Map<string, WhalePosition>();
          for (const position of stored) {
            if (succeeded.has(position.userAddress)) {
              storedByKey.set(positionKey(position), position);
            }
          }

          const changed = fresh.filter((position) => {
            const previous = storedByKey.get(positionKey(position));
            return (
              previous === undefined ||
              positionFingerprint(previous) !== positionFingerprint(position)
            );
          });

          const closed: WhalePositionKey[] = [];
          for (const [key, previous] of storedByKey) {
            if (!freshByKey.has(key)) {
              closed.push({ userAddress: previous.userAddress, coin: previous.coin });
            }
          }

          if (changed.length > 0) {
            yield* repo
              .upsertPositions(changed)
              .pipe(Effect.mapError(mapRepoError("Failed to upsert whale positions")));
          }
          if (closed.length > 0) {
            yield* repo
              .deleteClosedPositions(closed)
              .pipe(Effect.mapError(mapRepoError("Failed to delete closed whale positions")));
          }
        }),

      queryPositions: (q) =>
        repo
          .queryPositions(q)
          .pipe(Effect.mapError(mapRepoError("Failed to query whale positions"))),
    });
  });
