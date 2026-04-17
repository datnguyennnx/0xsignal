/** Rate Limiter - Token bucket rate limiting using Effect */

import { Effect, Context, Layer, Ref, Data } from "effect";

export class RateLimitExceeded extends Data.TaggedError("RateLimitExceeded")<{
  readonly source: string;
  readonly message: string;
  readonly retryAfterMs: number;
}> {}

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

export interface RateLimiter {
  readonly acquire: (source: string) => Effect.Effect<void, RateLimitExceeded>;
}

export class RateLimiterTag extends Context.Tag("RateLimiter")<RateLimiterTag, RateLimiter>() {}

interface RateLimiterConfig {
  readonly tokensPerMinute: number;
  readonly burstSize?: number;
}

const CONFIG: Record<string, RateLimiterConfig> = {};

const DEFAULT_CONFIG: RateLimiterConfig = { tokensPerMinute: 60, burstSize: 20 };

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

    const acquire = (source: string): Effect.Effect<void, RateLimitExceeded> =>
      Effect.gen(function* () {
        const config = getConfig(source);
        const decision = yield* Ref.modify(
          buckets,
          (m): readonly [{ allowed: boolean; retryAfterMs: number }, Map<string, TokenBucket>] => {
            const current = m.get(source) ?? {
              tokens: config.burstSize ?? config.tokensPerMinute,
              lastRefill: Date.now(),
            };

            const refilled = refillTokens(current, config);
            const updated = new Map(m);

            if (refilled.tokens >= 1) {
              updated.set(source, { ...refilled, tokens: refilled.tokens - 1 });
              return [{ allowed: true, retryAfterMs: 0 }, updated] as const;
            }

            const msUntilToken = (1 - refilled.tokens) / (config.tokensPerMinute / 60000);
            updated.set(source, refilled);
            return [{ allowed: false, retryAfterMs: Math.ceil(msUntilToken) }, updated] as const;
          }
        );

        if (decision.allowed) {
          return;
        }

        yield* Effect.fail(
          new RateLimitExceeded({
            source,
            message: `Rate limit exceeded for ${source}. Retry after ${decision.retryAfterMs}ms`,
            retryAfterMs: decision.retryAfterMs,
          })
        );
      });

    return { acquire };
  })
);
