import { Context, Deferred, Ref } from "effect";
import { HyperliquidError } from "./errors";

export class HyperliquidDeduplicationRegistry extends Context.Service<
  HyperliquidDeduplicationRegistry,
  {
    readonly registryRef: Ref.Ref<Map<string, Deferred.Deferred<any, HyperliquidError>>>;
  }
>()("HyperliquidDeduplicationRegistry") {}

// Note: The inline Layer that provides HyperliquidDeduplicationRegistry lives in
// provider.ts (inside hyperliquidProviderLayer). This module exports only the
// Context.Service for dependency injection wiring.
