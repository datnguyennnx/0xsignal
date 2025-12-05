/** Rate Limiter - Token bucket rate limiting using Effect */

import { Effect, Context, Layer, Ref, Duration, Data, pipe } from "effect";

export class RateLimitExceeded extends Data.TaggedError("RateLimitExceeded")<{
  readonly source: string;
  readonly retryAfterMs: number;
}> {}

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

export interface RateLimiter {
  readonly acquire: (source: string) => Effect.Effect<void, RateLimitExceeded>;
  readonly tryAcquire: (source: string) => Effect.Effect<boolean, never>;
}

export class RateLimiterTag extends Context.Tag("RateLimiter")<RateLimiterTag, RateLimiter>() {}

interface RateLimiterConfig {
  readonly tokensPerMinute: number;
  readonly burstSize?: number;
}

const CONFIG: Record<string, RateLimiterConfig> = {
  coingecko: { tokensPerMinute: 25, burstSize: 5 },
  defillama: { tokensPerMinute: 50, burstSize: 10 },
  binance: { tokensPerMinute: 1000, burstSize: 100 },
};

const DEFAULT_CONFIG: RateLimiterConfig = { tokensPerMinute: 60, burstSize: 10 };

const getConfig = (source: string): RateLimiterConfig =>
  CONFIG[source.toLowerCase()] ?? DEFAULT_CONFIG;

const refillTokens = (bucket: TokenBucket, config: RateLimiterConfig): TokenBucket => {
  const now = Date.now();
  const elapsed = now - bucket.lastRefill;
  const tokensPerMs = config.tokensPerMinute / 60000;
  const newTokens = Math.min(
    config.burstSize ?? config.tokensPerMinute,
    bucket.tokens + elapsed * tokensPerMs
  );
  return { tokens: newTokens, lastRefill: now };
};

export const RateLimiterLive = Layer.effect(
  RateLimiterTag,
  Effect.gen(function* () {
    const buckets = yield* Ref.make<Map<string, TokenBucket>>(new Map());

    const getBucket = (source: string) =>
      Ref.get(buckets).pipe(
        Effect.map((m) => m.get(source) ?? { tokens: 0, lastRefill: Date.now() })
      );

    const updateBucket = (source: string, bucket: TokenBucket) =>
      Ref.update(buckets, (m) => {
        const updated = new Map(m);
        updated.set(source, bucket);
        return updated;
      });

    const acquire = (source: string): Effect.Effect<void, RateLimitExceeded> =>
      Effect.gen(function* () {
        const config = getConfig(source);
        const current = yield* getBucket(source);
        const refilled = refillTokens(current, config);

        if (refilled.tokens >= 1) {
          yield* updateBucket(source, { ...refilled, tokens: refilled.tokens - 1 });
          return;
        }

        const msUntilToken = (1 - refilled.tokens) / (config.tokensPerMinute / 60000);
        yield* Effect.fail(
          new RateLimitExceeded({
            source,
            retryAfterMs: Math.ceil(msUntilToken),
          })
        );
      });

    const tryAcquire = (source: string): Effect.Effect<boolean, never> =>
      acquire(source).pipe(
        Effect.map(() => true),
        Effect.catchAll(() => Effect.succeed(false))
      );

    return { acquire, tryAcquire };
  })
);

export const withRateLimit = <A, E, R>(
  source: string,
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E | RateLimitExceeded, R | RateLimiterTag> =>
  pipe(
    RateLimiterTag,
    Effect.flatMap((limiter) => limiter.acquire(source)),
    Effect.flatMap(() => effect)
  );

export const withRateLimitRetry = <A, E, R>(
  source: string,
  effect: Effect.Effect<A, E, R>,
  maxRetries = 3
): Effect.Effect<A, E | RateLimitExceeded, R | RateLimiterTag> => {
  const attempt = (
    remaining: number
  ): Effect.Effect<A, E | RateLimitExceeded, R | RateLimiterTag> =>
    withRateLimit(source, effect).pipe(
      Effect.catchAll((err) => {
        if (err instanceof RateLimitExceeded && remaining > 0) {
          return Effect.sleep(Duration.millis(err.retryAfterMs)).pipe(
            Effect.flatMap(() => attempt(remaining - 1))
          );
        }
        return Effect.fail(err);
      })
    );
  return attempt(maxRetries);
};
