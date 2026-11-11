import { describe, expect, it } from "vitest";
import { Effect, Stream } from "effect";
import type {
  SubscribeOptions,
  Subscription,
  SubscriptionHandle,
  WsClient,
  WsTrade,
} from "@0xsignal/sdk-hyperliquid/subscription";
import { HyperliquidError } from "../errors";
import { openTradeStream } from "../whale-trade-stream";

type SubscribeFn = (
  subscription: Subscription,
  onData: (data: unknown) => void,
  options?: SubscribeOptions,
) => SubscriptionHandle;

const makeWsClient = (subscribe: SubscribeFn): WsClient => ({ subscribe }) as unknown as WsClient;

const handleFor = (
  subscription: Subscription,
  onRelease?: () => Promise<void>,
): SubscriptionHandle => ({
  subscription,
  unsubscribe: () => {},
  unsubscribeAsync: onRelease ?? (() => Promise.resolve()),
});

/** Minimal `WsTrade` payload: only the fields the bridge reads. */
const tradeEvent = (coin: string, tid: number): WsTrade =>
  ({
    coin,
    side: "B",
    px: "100",
    sz: "2",
    hash: "0x0",
    time: 1,
    users: ["0xbuyer", "0xseller"],
    tid,
  }) as unknown as WsTrade;

describe("whale trade stream errors", () => {
  it("fails the stream with a HyperliquidError when the SDK subscription reports an error", async () => {
    const subscriptions: Subscription[] = [];
    const client = makeWsClient((subscription, _onData, options) => {
      subscriptions.push(subscription);
      options?.onError?.(new Error("socket closed"));
      return handleFor(subscription);
    });

    const program = openTradeStream(client, ["BTC"], 0).pipe(Stream.runCollect, Effect.flip);

    const error = await Effect.runPromise(program);

    expect(error).toBeInstanceOf(HyperliquidError);
    expect(error.message).toBe("Failed to subscribe to trades for BTC");
    // The bridge must subscribe to the SDK's trades channel for the requested coin.
    expect(subscriptions).toEqual([{ type: "trades", coin: "BTC" }]);
  });
});

describe("whale trade stream subscription leaks", () => {
  it("unsubscribes coins acquired before a later subscribe fails", async () => {
    const subscriptions: Subscription[] = [];
    const unsubscribed: string[] = [];
    const client = makeWsClient((subscription) => {
      subscriptions.push(subscription);
      if (subscription.type !== "trades") throw new Error("unexpected subscription");
      if (subscription.coin === "ETH") throw new Error("subscribe failed");
      return handleFor(subscription, async () => {
        unsubscribed.push(subscription.coin);
      });
    });

    const program = openTradeStream(client, ["BTC", "ETH", "SOL"], 0).pipe(
      Stream.runCollect,
      Effect.flip,
    );

    const error = await Effect.runPromise(program);

    expect(error).toBeInstanceOf(HyperliquidError);
    expect(error.message).toBe("Failed to subscribe to trades for ETH");
    expect(subscriptions).toEqual([
      { type: "trades", coin: "BTC" },
      { type: "trades", coin: "ETH" },
    ]);
    // The acquired BTC subscription must not outlive the failed run.
    expect(unsubscribed).toEqual(["BTC"]);
  });

  it("keeps releasing the remaining coins when one unsubscribe rejects", async () => {
    const unsubscribed: string[] = [];
    let nextTid = 1;
    const client = makeWsClient((subscription, onData) => {
      if (subscription.type !== "trades") throw new Error("unexpected subscription");
      onData([tradeEvent(subscription.coin, nextTid++)]);
      return {
        subscription,
        unsubscribe: () => {},
        unsubscribeAsync: () => {
          unsubscribed.push(subscription.coin);
          return subscription.coin === "ETH"
            ? Promise.reject(new Error("unsubscribe failed"))
            : Promise.resolve();
        },
      };
    });

    const collected = await Effect.runPromise(
      openTradeStream(client, ["BTC", "ETH", "SOL"], 0).pipe(Stream.take(3), Stream.runCollect),
    );

    expect(collected).toHaveLength(3);
    // One rejecting release must not skip the other finalizers.
    expect(unsubscribed.toSorted()).toEqual(["BTC", "ETH", "SOL"]);
  });
});
