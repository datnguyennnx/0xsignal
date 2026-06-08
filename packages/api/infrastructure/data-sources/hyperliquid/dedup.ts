import { Context, Deferred, Ref } from "effect";
import { HyperliquidError } from "./errors";

export class HyperliquidDeduplicationRegistry extends Context.Service<
  HyperliquidDeduplicationRegistry,
  {
    readonly registryRef: Ref.Ref<Map<string, Deferred.Deferred<any, HyperliquidError>>>;
  }
>()("HyperliquidDeduplicationRegistry") {}
