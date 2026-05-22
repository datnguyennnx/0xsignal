import { Context, Deferred, Ref } from "effect";
import { HyperliquidError } from "./errors";

export class HyperliquidDeduplicationRegistry extends Context.Tag(
  "HyperliquidDeduplicationRegistry"
)<
  HyperliquidDeduplicationRegistry,
  {
    readonly registryRef: Ref.Ref<Map<string, Deferred.Deferred<any, HyperliquidError>>>;
  }
>() {}

// Note: The inline Layer that provides HyperliquidDeduplicationRegistry lives in
// provider.ts (inside hyperliquidProviderLayer). This module exports only the
// Context.Tag for dependency injection wiring.
