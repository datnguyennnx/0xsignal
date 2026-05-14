import { Context, Deferred, Effect, Layer, Ref } from "effect";
import { HyperliquidError } from "./errors";

export class HyperliquidDeduplicationRegistry extends Context.Tag(
  "HyperliquidDeduplicationRegistry"
)<
  HyperliquidDeduplicationRegistry,
  {
    readonly registryRef: Ref.Ref<Map<string, Deferred.Deferred<any, HyperliquidError>>>;
  }
>() {}

export const HyperliquidDeduplicationRegistryLive = Layer.effect(
  HyperliquidDeduplicationRegistry,
  Effect.gen(function* () {
    const ref = yield* Ref.make(new Map<string, Deferred.Deferred<any, HyperliquidError>>());
    return HyperliquidDeduplicationRegistry.of({
      registryRef: ref,
    });
  })
);
