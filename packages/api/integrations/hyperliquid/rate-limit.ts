import { Clock, Config, Context, Data, Duration, Effect, Layer, Ref } from "effect";
import { HyperliquidError } from "./data-sources/errors";
import {
  candleSnapshotWeight,
  INFO_WEIGHTS,
  UNLISTED_INFO_WEIGHT,
  type InfoOperation,
} from "./weights";

/**
 * Hyperliquid counts REST usage in weight. The documented budget is 1200 weight
 * per minute, refilled continuously, and a single call may cost up to 20 weight.
 * One shared limiter holds the whole process inside that budget.
 */
export class RateLimitBudgetExhaustedError extends Data.TaggedError(
  "RateLimitBudgetExhaustedError",
)<{
  readonly message: string;
  readonly weight: number;
  readonly capacityPerMin: number;
}> {}

interface SpendEntry {
  readonly atMillis: number;
  readonly weight: number;
}

interface RateLimiterState {
  readonly burstTokens: number;
  readonly lastRefillMillis: number;
  /** Admitted spend from the last 60s, oldest first. */
  readonly window: ReadonlyArray<SpendEntry>;
}

interface Admission {
  /** Zero means granted; otherwise how long to sleep before re-checking. */
  readonly waitMillis: number;
}

interface ResolvedLimits {
  readonly perSecond: number;
  readonly perMinute: number;
  readonly burstCapacity: number;
}

export interface HyperliquidRateLimiterService {
  readonly acquire: (
    weight: number,
    options?: AcquireOptions,
  ) => Effect.Effect<void, RateLimitBudgetExhaustedError>;
}

export interface AcquireOptions {
  /**
   * Total time this acquire may spend waiting. Omitted means wait as long as
   * the rolling window needs; that is right for cheap info calls, which must
   * eventually run. Expensive upstream calls bound it so a caller cannot park
   * the shared budget and stall every other tenant.
   */
  readonly maxWaitMillis?: number | undefined;
}

export class HyperliquidRateLimiter extends Context.Service<
  HyperliquidRateLimiter,
  HyperliquidRateLimiterService
>()("HyperliquidRateLimiter") {}

const DEFAULT_WEIGHT_PER_SECOND = 20;
const DEFAULT_WEIGHT_PER_MINUTE = 1200;
/** Burst bucket: one page load is ~236 weight; a whale tick adds ~302. */
const DEFAULT_BURST_WEIGHT = 400;
/**
 * A candle range is caller-controlled and can cost ~103 weight, so its wait is
 * capped: past this the request fails fast as unavailable instead of sleeping
 * and holding budget that every other tenant needs.
 */
export const CANDLE_ADMISSION_MAX_WAIT_MS = 2_000;
const MILLIS_PER_SECOND = 1_000;
/** Hard budget window. Supply is `perMinute` per rolling 60s, not burst + refill. */
const WINDOW_MILLIS = 60_000;
/**
 * Worst case is 1200/2 = 600 entries, since the smallest documented charge is 2.
 * Merging the two oldest keeps the bound for callers that pass a smaller weight.
 */
const MAX_WINDOW_ENTRIES = 600;

export interface LimiterLimits {
  /** Continuous refill of the burst bucket, in weight per second. */
  readonly perSecond: number;
  /** Hard ceiling for any rolling minute, in weight. */
  readonly perMinute: number;
  /** Maximum weight the burst bucket can hold at once. */
  readonly burstCapacity?: number | undefined;
}

/**
 * Tokens start full so a cold process can serve its first page load without
 * serialising 236/20 = 11.8s. The burst bucket only smooths spikes: the rolling
 * minute window is the supply ceiling, so the first 60s are capped at 1200
 * weight instead of `400 + 20 x 60 = 1600`.
 */
export const makeLimiter = (limits: LimiterLimits): Effect.Effect<HyperliquidRateLimiterService> =>
  Effect.gen(function* () {
    const resolved: ResolvedLimits = {
      perSecond: Math.max(1, limits.perSecond),
      perMinute: Math.max(1, limits.perMinute),
      burstCapacity: Math.max(1, limits.burstCapacity ?? DEFAULT_BURST_WEIGHT),
    };
    const now = yield* Clock.currentTimeMillis;
    const state = yield* Ref.make<RateLimiterState>({
      burstTokens: resolved.burstCapacity,
      lastRefillMillis: now,
      window: [],
    });

    const acquire = (
      weight: number,
      options?: AcquireOptions,
    ): Effect.Effect<void, RateLimitBudgetExhaustedError> =>
      Effect.gen(function* () {
        if (weight <= 0) return;

        const exceedsBurst = weight > resolved.burstCapacity;
        const exceedsMinute = weight > resolved.perMinute;
        if (exceedsBurst || exceedsMinute) {
          const offendingLimits = [
            exceedsBurst ? `burst capacity ${resolved.burstCapacity}` : null,
            exceedsMinute ? `per-minute ceiling ${resolved.perMinute}` : null,
          ]
            .filter((limit) => limit !== null)
            .join(" and ");
          yield* Effect.fail(refusal(weight, offendingLimits, resolved.perMinute));
          return;
        }

        let waitedMillis = 0;
        while (true) {
          const atMillis = yield* Clock.currentTimeMillis;
          const outcome = yield* Ref.modify(state, (previous) =>
            decide(previous, weight, atMillis, resolved),
          );
          if (outcome.waitMillis === 0) return;
          const maxWaitMillis = options?.maxWaitMillis;
          if (maxWaitMillis !== undefined && waitedMillis + outcome.waitMillis > maxWaitMillis) {
            yield* Effect.fail(
              new RateLimitBudgetExhaustedError({
                message: `REST weight ${weight} is not admissible within ${maxWaitMillis}ms`,
                weight,
                capacityPerMin: resolved.perMinute,
              }),
            );
            return;
          }
          waitedMillis += outcome.waitMillis;
          // Sleep outside the atomic refill, so a light wait never queues behind
          // a heavy one and every waiter recomputes its own wait independently.
          yield* Effect.sleep(Duration.millis(outcome.waitMillis));
        }
      });

    return { acquire };
  });

const refusal = (
  weight: number,
  offendingLimits: string,
  capacityPerMin: number,
): RateLimitBudgetExhaustedError =>
  new RateLimitBudgetExhaustedError({
    message: `REST weight ${weight} exceeds the ${offendingLimits}`,
    weight,
    capacityPerMin,
  });

/** Refills the burst bucket, prunes the minute window, then admits or reports the shortfall. */
const decide = (
  previous: RateLimiterState,
  weight: number,
  atMillis: number,
  limits: ResolvedLimits,
): readonly [Admission, RateLimiterState] => {
  const base = Math.max(atMillis, previous.lastRefillMillis);
  const elapsed = base - previous.lastRefillMillis;
  const burstTokens = Math.min(
    limits.burstCapacity,
    previous.burstTokens + (elapsed * limits.perSecond) / MILLIS_PER_SECOND,
  );
  const window = pruneWindow(previous.window, base);
  const spent = window.reduce((total, entry) => total + entry.weight, 0);

  // Invariant: spent <= perMinute, so no rolling 60s ever exceeds the budget.
  if (burstTokens >= weight && spent + weight <= limits.perMinute) {
    return [
      { waitMillis: 0 },
      {
        burstTokens: burstTokens - weight,
        lastRefillMillis: base,
        window: appendSpend(window, { atMillis: base, weight }),
      },
    ];
  }

  const missingBurst = Math.max(0, weight - burstTokens);
  const waitMillis = Math.max(
    1,
    Math.ceil(
      Math.max(
        (missingBurst / limits.perSecond) * MILLIS_PER_SECOND,
        waitForWindow(window, spent, weight, limits.perMinute, base),
      ),
    ),
  );
  return [{ waitMillis }, { burstTokens, lastRefillMillis: base, window }];
};

/** Keeps spend younger than the window; entries at exactly the boundary have aged out. */
const pruneWindow = (
  window: ReadonlyArray<SpendEntry>,
  atMillis: number,
): ReadonlyArray<SpendEntry> => window.filter((entry) => atMillis - entry.atMillis < WINDOW_MILLIS);

/** Appends a spend and merges the two oldest entries past the size bound. */
const appendSpend = (
  window: ReadonlyArray<SpendEntry>,
  entry: SpendEntry,
): ReadonlyArray<SpendEntry> => {
  const next = [...window, entry];
  if (next.length <= MAX_WINDOW_ENTRIES) return next;
  const [oldest, secondOldest, ...rest] = next;
  // The newer timestamp keeps the merged weight in the window at least as long.
  return [
    { atMillis: secondOldest.atMillis, weight: oldest.weight + secondOldest.weight },
    ...rest,
  ];
};

/** Zero when the window has room, else ms until enough of the oldest spend ages out. */
const waitForWindow = (
  window: ReadonlyArray<SpendEntry>,
  spent: number,
  weight: number,
  perMinute: number,
  atMillis: number,
): number => {
  let excess = spent + weight - perMinute;
  if (excess <= 0) return 0;
  for (const entry of window) {
    excess -= entry.weight;
    if (excess <= 0) return entry.atMillis + WINDOW_MILLIS - atMillis;
  }
  // Unreachable while spent <= perMinute; a full window is the safe fallback.
  return WINDOW_MILLIS;
};

/** Reports a limiter refusal as a rate-limited upstream error. */
const acquireWeight = (
  weight: number,
  options?: AcquireOptions,
): Effect.Effect<void, HyperliquidError, HyperliquidRateLimiter> =>
  Effect.gen(function* () {
    const limiter = yield* HyperliquidRateLimiter;
    yield* limiter.acquire(weight, options).pipe(
      Effect.mapError(
        (error) =>
          new HyperliquidError({
            message: error.message,
            kind: "RATE_LIMITED",
            cause: error,
          }),
      ),
    );
  });

/** Charges the limiter at the documented weight of the info operation. */
export const acquireInfo = (
  operation: InfoOperation,
): Effect.Effect<void, HyperliquidError, HyperliquidRateLimiter> =>
  acquireWeight(INFO_WEIGHTS[operation]);

/** Candle weight grows with the requested item count. Do not use `acquireInfo`. */
export const acquireCandleSnapshot = (
  count: number,
  options?: AcquireOptions,
): Effect.Effect<void, HyperliquidError, HyperliquidRateLimiter> =>
  acquireWeight(candleSnapshotWeight(count), options);

/** Same charge against an already-resolved limiter, for layers that hold the instance. */
export const acquireInfoFor = (
  limiter: HyperliquidRateLimiterService,
  operation: InfoOperation,
): Effect.Effect<void, HyperliquidError> =>
  limiter
    .acquire(INFO_WEIGHTS[operation])
    .pipe(
      Effect.mapError(
        (error) =>
          new HyperliquidError({ message: error.message, kind: "RATE_LIMITED", cause: error }),
      ),
    );

/** Operations missing from the published weight table keep the flat estimate. */
export const acquireUnlistedInfo: Effect.Effect<void, HyperliquidError, HyperliquidRateLimiter> =
  acquireWeight(UNLISTED_INFO_WEIGHT);

export const layer: Layer.Layer<HyperliquidRateLimiter, Config.ConfigError> = Layer.effect(
  HyperliquidRateLimiter,
  Effect.gen(function* () {
    const perSecond = yield* Config.Number("HL_RATE_WEIGHT_PER_SECOND").pipe(
      Config.withDefault(DEFAULT_WEIGHT_PER_SECOND),
    );
    const perMinute = yield* Config.Number("HL_RATE_WEIGHT_PER_MINUTE").pipe(
      Config.withDefault(DEFAULT_WEIGHT_PER_MINUTE),
    );
    const burstCapacity = yield* Config.Number("HL_RATE_BURST_WEIGHT").pipe(
      Config.withDefault(DEFAULT_BURST_WEIGHT),
    );
    return yield* makeLimiter({ perSecond, perMinute, burstCapacity });
  }),
);

export const layerUnlimited: Layer.Layer<HyperliquidRateLimiter> = Layer.succeed(
  HyperliquidRateLimiter,
  HyperliquidRateLimiter.of({ acquire: () => Effect.void }),
);
