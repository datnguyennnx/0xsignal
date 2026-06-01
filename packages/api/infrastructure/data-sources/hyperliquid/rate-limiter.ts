import { Context } from "effect";
import type { Semaphore } from "effect/Semaphore";

export class HyperliquidRateLimiter extends Context.Service<
  HyperliquidRateLimiter,
  {
    readonly semaphore: Semaphore;
  }
>()("HyperliquidRateLimiter") {}

// Note: The inline Layer that provides HyperliquidRateLimiter lives in
// provider.ts (inside hyperliquidProviderLayer). This module exports only the
// Context.Service for dependency injection wiring.
