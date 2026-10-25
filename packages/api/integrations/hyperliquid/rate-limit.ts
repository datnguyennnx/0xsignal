import { Clock, Config, Context, Data, Duration, Effect, Layer, Ref, Semaphore } from "effect";
import { HyperliquidError } from "./data-sources/errors";

/**
 * Hyperliquid counts REST usage in weight, but enforces it per second as well as
 * over a minute. One shared limiter is the only thing that keeps a burst of
 * concurrent handlers inside the per-second cap.
 */
export class RateLimitBudgetExhaustedError extends Data.TaggedError(
  "RateLimitBudgetExhaustedError",
)<{
  readonly message: string;
  readonly weight: number;
  readonly capacityPerMin: number;
}> {}

interface RateLimiterState {
  readonly tokensPerSecond: number;
  readonly tokensPerMinute: number;
  readonly lastRefillMillis: number;
}

export interface HyperliquidRateLimiterService {
  readonly acquire: (weight: number) => Effect.Effect<void, RateLimitBudgetExhaustedError>;
}

export class HyperliquidRateLimiter extends Context.Service<
  HyperliquidRateLimiter,
  HyperliquidRateLimiterService
>()("HyperliquidRateLimiter") {}

/** A normal info request costs weight 2. */
export const INFO_REQUEST_WEIGHT = 2;

const DEFAULT_WEIGHT_PER_SECOND = 20;
const DEFAULT_WEIGHT_PER_MINUTE = 600;
const MILLIS_PER_MINUTE = 60_000;
const MILLIS_PER_SECOND = 1_000;
const SECONDS_PER_MINUTE = 60;

export const makeLimiter = (limits: {
  readonly perSecond: number;
  readonly perMinute: number;
}): Effect.Effect<HyperliquidRateLimiterService> =>
  Effect.gen(function* () {
    const perSecond = Math.max(1, limits.perSecond);
    // A minute budget above perSecond * 60 can never be spent without breaching
    // the per-second cap, so the tighter cap wins instead of sleeping forever.
    const perMinute = Math.min(Math.max(1, limits.perMinute), perSecond * SECONDS_PER_MINUTE);
    const now = yield* Clock.currentTimeMillis;
    // Both buckets start empty. Even one second's worth of tokens let the first
    // tick fire a burst of calls; an empty start makes the limiter the only
    // source of permission and costs one refill interval at process start.
    const state = yield* Ref.make<RateLimiterState>({
      tokensPerSecond: 0,
      tokensPerMinute: 0,
      lastRefillMillis: now,
    });
    const lock = yield* Semaphore.make(1);

    const acquire = (weight: number): Effect.Effect<void, RateLimitBudgetExhaustedError> =>
      lock.withPermits(1)(
        Effect.gen(function* () {
          if (weight <= 0) return;
          const exceedsPerSecond = weight > perSecond;
          const exceedsPerMinute = weight > perMinute;
          if (exceedsPerSecond || exceedsPerMinute) {
            const offendingLimits = [
              exceedsPerSecond ? `per-second ceiling ${perSecond}` : null,
              exceedsPerMinute ? `per-minute ceiling ${perMinute}` : null,
            ]
              .filter((limit) => limit !== null)
              .join(" and ");
            yield* Effect.fail(
              new RateLimitBudgetExhaustedError({
                message: `REST weight ${weight} exceeds the ${offendingLimits}`,
                weight,
                capacityPerMin: perMinute,
              }),
            );
            return;
          }

          while (true) {
            const current = yield* Clock.currentTimeMillis;
            const previous = yield* Ref.get(state);
            const elapsed = Math.max(0, current - previous.lastRefillMillis);
            const tokensPerSecond = Math.min(
              perSecond,
              previous.tokensPerSecond + (elapsed * perSecond) / MILLIS_PER_SECOND,
            );
            const tokensPerMinute = Math.min(
              perMinute,
              previous.tokensPerMinute + (elapsed * perMinute) / MILLIS_PER_MINUTE,
            );
            const missingPerSecond = Math.max(0, weight - tokensPerSecond);
            const missingPerMinute = Math.max(0, weight - tokensPerMinute);

            if (missingPerSecond === 0 && missingPerMinute === 0) {
              yield* Ref.set(state, {
                tokensPerSecond: tokensPerSecond - weight,
                tokensPerMinute: tokensPerMinute - weight,
                lastRefillMillis: current,
              });
              return;
            }

            const waitMillis = Math.max(
              1,
              Math.ceil(
                Math.max(
                  (missingPerSecond / perSecond) * MILLIS_PER_SECOND,
                  (missingPerMinute / perMinute) * MILLIS_PER_MINUTE,
                ),
              ),
            );
            yield* Ref.set(state, {
              tokensPerSecond,
              tokensPerMinute,
              lastRefillMillis: current,
            });
            yield* Effect.sleep(Duration.millis(waitMillis));
          }
        }),
      );

    return { acquire };
  });

/** Bounded acquire that reports a limiter refusal as a rate-limited upstream error. */
export const acquireInfoWeight: Effect.Effect<void, HyperliquidError, HyperliquidRateLimiter> =
  Effect.gen(function* () {
    const limiter = yield* HyperliquidRateLimiter;
    yield* limiter.acquire(INFO_REQUEST_WEIGHT).pipe(
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

export const layer: Layer.Layer<HyperliquidRateLimiter, Config.ConfigError> = Layer.effect(
  HyperliquidRateLimiter,
  Effect.gen(function* () {
    const perSecond = yield* Config.Number("HL_RATE_WEIGHT_PER_SECOND").pipe(
      Config.withDefault(DEFAULT_WEIGHT_PER_SECOND),
    );
    const perMinute = yield* Config.Number("HL_RATE_WEIGHT_PER_MINUTE").pipe(
      Config.withDefault(DEFAULT_WEIGHT_PER_MINUTE),
    );
    return yield* makeLimiter({ perSecond, perMinute });
  }),
);

export const layerUnlimited: Layer.Layer<HyperliquidRateLimiter> = Layer.succeed(
  HyperliquidRateLimiter,
  HyperliquidRateLimiter.of({ acquire: () => Effect.void }),
);
