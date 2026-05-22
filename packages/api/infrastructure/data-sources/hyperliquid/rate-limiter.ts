import { Context, Effect } from "effect";

export class HyperliquidRateLimiter extends Context.Tag("HyperliquidRateLimiter")<
  HyperliquidRateLimiter,
  {
    readonly semaphore: Effect.Semaphore;
  }
>() {}

// Note: The inline Layer that provides HyperliquidRateLimiter lives in
// provider.ts (inside hyperliquidProviderLayer). This module exports only the
// Context.Tag for dependency injection wiring.
