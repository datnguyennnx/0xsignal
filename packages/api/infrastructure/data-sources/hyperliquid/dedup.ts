import { Context, Effect, Ref } from "effect";
import type { Cache } from "effect";
import { HyperliquidError } from "./errors";
import type { DedupCacheValue } from "./provider-cache";

export class HyperliquidDeduplicationRegistry extends Context.Service<
  HyperliquidDeduplicationRegistry,
  {
    readonly cache: Cache.Cache<string, DedupCacheValue, HyperliquidError, never>;
    readonly lookupRef: Ref.Ref<Map<string, Effect.Effect<DedupCacheValue, HyperliquidError>>>;
  }
>()("HyperliquidDeduplicationRegistry") {}
