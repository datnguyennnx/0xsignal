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

/** Minimal `TradesEvent` payload: only the fields the bridge reads. */
const tradeEvent = (coin: string, tid: number) =>
  ({
    coin,
    side: "B",
    px: "100",
    sz: "2",
    time: 1,
    users: ["0xbuyer", "0xseller"],
    tid,
  }) as never;

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

describe("whale trade stream subscription leaks", () => {
  it("unsubscribes coins acquired before a later subscribe fails", async () => {
    const unsubscribed: string[] = [];
    const client = Object.assign(new SubscriptionClient({ transport: unusedTransport }), {
      trades: (params: { readonly coin: string }) => {
        if (params.coin === "ETH") return Promise.reject(new Error("subscribe failed"));
        return Promise.resolve({
          unsubscribe: () => {
            unsubscribed.push(params.coin);
            return Promise.resolve();
          },
        });
      },
    });

    const program = openTradeStream(client, ["BTC", "ETH", "SOL"], 0).pipe(
      Stream.runCollect,
      Effect.flip,
    );

    const error = await Effect.runPromise(program);

    expect(error).toBeInstanceOf(HyperliquidError);
    expect(error.message).toBe("Failed to subscribe to trades for ETH");
    // The acquired BTC subscription must not outlive the failed run.
    expect(unsubscribed).toEqual(["BTC"]);
  });

  it("keeps releasing the remaining coins when one unsubscribe rejects", async () => {
    const unsubscribed: string[] = [];
    let nextTid = 1;
    const client = Object.assign(new SubscriptionClient({ transport: unusedTransport }), {
      trades: (
        params: { readonly coin: string },
        listener: (trades: readonly unknown[]) => void,
      ) => {
        listener([tradeEvent(params.coin, nextTid++)]);
        return Promise.resolve({
          unsubscribe: () => {
            unsubscribed.push(params.coin);
            return params.coin === "ETH"
              ? Promise.reject(new Error("unsubscribe failed"))
              : Promise.resolve();
          },
        });
      },
    });

    const collected = await Effect.runPromise(
      openTradeStream(client, ["BTC", "ETH", "SOL"], 0).pipe(Stream.take(3), Stream.runCollect),
    );

    expect(collected).toHaveLength(3);
    // One rejecting release must not skip the other finalizers.
    expect(unsubscribed.toSorted()).toEqual(["BTC", "ETH", "SOL"]);
  });
});
