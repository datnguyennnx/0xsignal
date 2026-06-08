import { Context } from "effect";
import type { Semaphore } from "effect/Semaphore";

export class HyperliquidRateLimiter extends Context.Service<
  HyperliquidRateLimiter,
  {
    readonly semaphore: Semaphore;
  }
>()("HyperliquidRateLimiter") {}
