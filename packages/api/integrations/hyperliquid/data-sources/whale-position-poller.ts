import { Context, Effect, Layer, Predicate, Schedule } from "effect";
import type { ClearinghouseState, WhalePosition, WhaleSide } from "@0xsignal/shared";
import { HyperliquidClient } from "./hyperliquid-client";
import { WhaleConfig } from "../../../modules/whales";
import { HyperliquidError, toHyperliquidError } from "./errors";
import {
  HyperliquidRateLimiter,
  INFO_REQUEST_WEIGHT,
  type RateLimitBudgetExhaustedError,
} from "../rate-limit";

type AssetPosition = ClearinghouseState["assetPositions"][number];

const MAX_CONCURRENCY = 5;
const RETRY_MAX = 3;

const parseNumber = (value: string | number | null | undefined, fallback = 0): number => {
  if (value === null || value === undefined) return fallback;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

// The kind is set by `toHyperliquidError` from the raw cause's 429 status.
const isRateLimited = (error: HyperliquidError): boolean => error.kind === "RATE_LIMITED";

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
  HyperliquidClient | WhaleConfig | HyperliquidRateLimiter
> = Layer.effect(
  WhalePositionPoller,
  Effect.gen(function* () {
    const { info } = yield* HyperliquidClient;
    const config = yield* WhaleConfig;
    const limiter = yield* HyperliquidRateLimiter;

    const fetchMarks = (): Effect.Effect<
      Readonly<Record<string, string>>,
      RateLimitBudgetExhaustedError
    > =>
      Effect.gen(function* () {
        yield* limiter.acquire(INFO_REQUEST_WEIGHT);
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
        yield* limiter.acquire(INFO_REQUEST_WEIGHT);
        return yield* Effect.tryPromise({
          try: () => info.clearinghouseState({ user: address }),
          catch: (cause) => toHyperliquidError(`clearinghouseState failed for ${address}`, cause),
        });
      }).pipe(
        // Never retry RATE_LIMITED: each attempt re-acquires budget and deepens
        // the 429 cascade. Only transport-level failures are worth another try.
        Effect.retry({
          times: RETRY_MAX,
          schedule: Schedule.exponential("250 millis").pipe(Schedule.jittered),
          while: (error: WhalePositionPollerError) =>
            Predicate.isTagged(error, "HyperliquidError") && error.kind === "UPSTREAM",
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
                  isRateLimited(error)
                    ? Effect.logInfo(
                        `[whale-position-poller] ${address} skipped on rate limit`,
                      ).pipe(Effect.asVoid)
                    : Effect.logWarning(
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
