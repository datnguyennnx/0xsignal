import { Context, Effect, Layer } from "effect";

export class HyperliquidRateLimiter extends Context.Tag("HyperliquidRateLimiter")<
  HyperliquidRateLimiter,
  {
    readonly semaphore: Effect.Semaphore;
  }
>() {}

export const HyperliquidRateLimiterLive = Layer.succeed(
  HyperliquidRateLimiter,
  HyperliquidRateLimiter.of({
    semaphore: Effect.unsafeMakeSemaphore(6),
  })
);
