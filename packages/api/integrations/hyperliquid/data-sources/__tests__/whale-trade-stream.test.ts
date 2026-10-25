import { describe, expect, it } from "vitest";
import { Effect, Stream } from "effect";
import {
  SubscriptionClient,
  type ISubscription,
  type ISubscriptionTransport,
} from "@nktkas/hyperliquid";
import { HyperliquidError } from "../errors";
import { openTradeStream } from "../whale-trade-stream";

const unusedTransport: ISubscriptionTransport = {
  subscribe: () => Promise.reject(new Error("unused transport")),
};

const stubSubscription: ISubscription = { unsubscribe: () => Promise.resolve() };

type TradesOptions = { readonly onError?: (error: unknown) => void };

/** Subscription client whose `trades` subscription reports a transport failure. */
const failingClient = (): SubscriptionClient =>
  Object.assign(new SubscriptionClient({ transport: unusedTransport }), {
    trades: (_params: unknown, _listener: unknown, options?: TradesOptions) => {
      options?.onError?.(new Error("socket closed"));
      return Promise.resolve(stubSubscription);
    },
  });

describe("whale trade stream errors", () => {
  it("fails the stream with a HyperliquidError when the SDK subscription reports an error", async () => {
    const program = openTradeStream(failingClient(), ["BTC"], 0).pipe(
      Stream.runCollect,
      Effect.flip,
    );

    const error = await Effect.runPromise(program);

    expect(error).toBeInstanceOf(HyperliquidError);
    expect(error.message).toBe("Failed to subscribe to trades for BTC");
  });
});
