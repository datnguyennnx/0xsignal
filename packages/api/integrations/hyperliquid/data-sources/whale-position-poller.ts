import { Context, Data, Duration, Effect, Layer, Predicate, Ref, Schedule } from "effect";
import type { ClearinghouseState, WhalePosition, WhaleSide } from "@0xsignal/shared";
import { HyperliquidClient } from "./hyperliquid-client";
import { WhaleConfig } from "../../../modules/whales";
import { HyperliquidError, toHyperliquidError } from "./errors";

type AssetPosition = ClearinghouseState["assetPositions"][number];

// Each clearinghouseState / allMids call costs REST weight 2.
const REST_WEIGHT_PER_CALL = 2;
const MAX_CONCURRENCY = 5;
const RETRY_MAX = 3;
const CAPACITY_REFILL_CEILING_MS = 1_000;
// The slowest legitimate refill (capacity 1, weight 1) needs 60 one-second
// waits; this cap leaves room for concurrent callers and still terminates.
const MAX_BUDGET_WAIT_ATTEMPTS = 600;

export class RateLimitBudgetExhaustedError extends Data.TaggedError(
  "RateLimitBudgetExhaustedError",
)<{
  readonly message: string;
  readonly weight: number;
  readonly capacityPerMin: number;
}> {}

interface TokenBucket {
  readonly acquire: (weight: number) => Effect.Effect<void, RateLimitBudgetExhaustedError>;
}

/**
 * Inline token bucket: `capacityPerMin` tokens refill continuously. Each caller
 * waits until `weight` tokens are available, so upstream calls never exceed the
 * configured REST weight budget.
 */
const makeTokenBucket = (capacityPerMin: number): Effect.Effect<TokenBucket> =>
  Effect.gen(function* () {
    const capacity = Math.max(1, capacityPerMin);
    const refillPerMs = capacity / 60_000;
    const state = yield* Ref.make<readonly [number, number]>([capacity, Date.now()]);

    const acquire = (weight: number): Effect.Effect<void, RateLimitBudgetExhaustedError> =>
      Effect.gen(function* () {
        // A weight above capacity can never be granted by any amount of waiting.
        if (weight > capacity) {
          yield* Effect.fail(
            new RateLimitBudgetExhaustedError({
              message: `REST weight ${weight} exceeds the per-minute budget ${capacity}`,
              weight,
              capacityPerMin: capacity,
            }),
          );
        }

        const attempt = Effect.gen(function* () {
          const now = Date.now();
          const [tokens, lastRefill] = yield* Ref.get(state);
          const available = Math.min(capacity, tokens + (now - lastRefill) * refillPerMs);
          if (available >= weight) {
            yield* Ref.set(state, [available - weight, now]);
            return true;
          }
          const waitMs = Math.max(1, Math.ceil((weight - available) / refillPerMs));
          yield* Effect.sleep(Duration.millis(Math.min(waitMs, CAPACITY_REFILL_CEILING_MS)));
          return false;
        });

        const granted = yield* attempt.pipe(
          Effect.repeat({
            schedule: Schedule.recurs(MAX_BUDGET_WAIT_ATTEMPTS),
            until: (done) => done,
          }),
        );
        if (!granted) {
          yield* Effect.fail(
            new RateLimitBudgetExhaustedError({
              message: `REST weight ${weight} unavailable after ${MAX_BUDGET_WAIT_ATTEMPTS} waits`,
              weight,
              capacityPerMin: capacity,
            }),
          );
        }
      });

    return { acquire };
  });

const parseNumber = (value: string | number | null | undefined, fallback = 0): number => {
  if (value === null || value === undefined) return fallback;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const mapPosition = (
  address: string,
  position: AssetPosition["position"],
  entryTime: string,
  marks: Readonly<Record<string, string>>,
): WhalePosition | null => {
  const signedSize = parseNumber(position.szi);
  const size = Math.abs(signedSize);
  if (size === 0) return null;

  const side: WhaleSide = signedSize < 0 ? "sell" : "buy";
  const markPrice = marks[position.coin] ?? position.entryPx;
  const mark = parseNumber(markPrice);
  const notionalUsd = mark > 0 ? size * mark : Math.abs(parseNumber(position.positionValue));
  const fundingFee =
    position.cumFunding === undefined ? undefined : parseNumber(position.cumFunding.sinceOpen);

  return {
    userAddress: address,
    coin: position.coin,
    side,
    size,
    notionalUsd,
    entryPx: position.entryPx,
    liquidationPx: position.liquidationPx ?? undefined,
    leverage: position.leverage?.value,
    leverageType: position.leverage?.type,
    marginUsd: parseNumber(position.marginUsed),
    unrealizedPnl: parseNumber(position.unrealizedPnl),
    unrealizedPnlPct: parseNumber(position.returnOnEquity) * 100,
    fundingFee,
    markPrice,
    entryTime,
  };
};

interface WhalePollResult {
  readonly positions: WhalePosition[];
  /** Addresses fetched successfully; a wallet that failed after retries is absent. */
  readonly succeededAddresses: string[];
}

type WhalePositionPollerError = HyperliquidError | RateLimitBudgetExhaustedError;

export interface WhalePositionPollerProvider {
  readonly pollPositions: (
    addresses: string[],
  ) => Effect.Effect<WhalePollResult, WhalePositionPollerError>;
}

export class WhalePositionPoller extends Context.Service<
  WhalePositionPoller,
  WhalePositionPollerProvider
>()("WhalePositionPoller") {}

/**
 * Construction opens no fibers and hits no network: the bucket is allocated and
 * `pollPositions` performs all upstream work when invoked.
 */
export const whalePositionPollerLayer: Layer.Layer<
  WhalePositionPoller,
  never,
  HyperliquidClient | WhaleConfig
> = Layer.effect(
  WhalePositionPoller,
  Effect.gen(function* () {
    const { info } = yield* HyperliquidClient;
    const config = yield* WhaleConfig;
    const bucket = yield* makeTokenBucket(config.restWeightBudgetPerMin);

    const fetchMarks = (): Effect.Effect<
      Readonly<Record<string, string>>,
      RateLimitBudgetExhaustedError
    > =>
      Effect.gen(function* () {
        yield* bucket.acquire(REST_WEIGHT_PER_CALL);
        return yield* Effect.tryPromise({
          try: () => info.allMids(),
          catch: (cause) => toHyperliquidError("allMids failed", cause),
        }).pipe(
          Effect.catchTag("HyperliquidError", () => Effect.succeed<Record<string, string>>({})),
        );
      });

    const fetchState = (
      address: string,
    ): Effect.Effect<ClearinghouseState, WhalePositionPollerError> =>
      Effect.gen(function* () {
        yield* bucket.acquire(REST_WEIGHT_PER_CALL);
        return yield* Effect.tryPromise({
          try: () => info.clearinghouseState({ user: address }),
          catch: (cause) => toHyperliquidError(`clearinghouseState failed for ${address}`, cause),
        });
      }).pipe(
        Effect.retry({
          times: RETRY_MAX,
          schedule: Schedule.exponential("250 millis").pipe(Schedule.jittered),
          while: (error: WhalePositionPollerError) =>
            Predicate.isTagged(error, "HyperliquidError") && error.kind === "RATE_LIMITED",
        }),
      );

    return WhalePositionPoller.of({
      pollPositions: (addresses) =>
        Effect.gen(function* () {
          const capped = addresses.slice(0, Math.max(0, config.maxWalletsPerPoll));
          if (capped.length === 0) return { positions: [], succeededAddresses: [] };

          const marks = yield* fetchMarks();
          const perWallet = yield* Effect.all(
            capped.map((address) =>
              fetchState(address).pipe(
                Effect.map((state) => ({
                  address,
                  positions: state.assetPositions
                    .map((entry) =>
                      mapPosition(
                        address,
                        entry.position,
                        new Date(state.time).toISOString(),
                        marks,
                      ),
                    )
                    .filter((position): position is WhalePosition => position !== null),
                })),
                Effect.catchTag("HyperliquidError", (error) =>
                  Effect.logWarning(
                    `[whale-position-poller] ${address} skipped: ${error.message}`,
                  ).pipe(Effect.asVoid),
                ),
              ),
            ),
            { concurrency: MAX_CONCURRENCY },
          );

          const positions: WhalePosition[] = [];
          const succeededAddresses: string[] = [];
          for (const result of perWallet) {
            if (result === undefined) continue;
            succeededAddresses.push(result.address);
            positions.push(...result.positions);
          }
          return { positions, succeededAddresses };
        }),
    });
  }),
);
