import { describe, expect, it } from "vitest";
import { Effect, Ref } from "effect";
import {
  addMarketWsConnectionSubscription,
  removeMarketWsConnectionSubscription,
  type MarketWsConnectionSubscription,
} from "../hub-types";

describe("market ws connection subscriptions aliasing", () => {
  it("keeps a previously read map an independent snapshot across add and remove", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const subscriptions = yield* Ref.make(new Map<string, MarketWsConnectionSubscription>());

        const beforeAdd = yield* Ref.get(subscriptions);
        yield* addMarketWsConnectionSubscription(subscriptions, { channel: "allMids" }, "allMids:");

        expect([...beforeAdd.keys()]).toEqual([]);
        expect([...(yield* Ref.get(subscriptions)).keys()]).toEqual(["allMids:"]);

        const beforeRemove = yield* Ref.get(subscriptions);
        yield* removeMarketWsConnectionSubscription(subscriptions, "allMids:");

        expect(beforeRemove.has("allMids:")).toBe(true);
        expect((yield* Ref.get(subscriptions)).size).toBe(0);
      }),
    );
  });
});
