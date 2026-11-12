import { expect, test } from "bun:test";
import type { WsClient } from "./client";
import type { WsBook } from "./types";

export function assertTypedSubscriptionPayloads(ws: WsClient): void {
  ws.subscribe({ type: "l2Book", coin: "BTC" }, (d) => {
    void d.levels[0][0]!.px;
  });
  ws.subscribe({ type: "trades", coin: "BTC" }, (d) => {
    void d[0]!.px;
  });
}

/** Proves an l2Book payload carries no `orders` field without expecting an error. */
type L2BookHasNoOrders = "orders" extends keyof WsBook ? never : true;

const _l2BookHasNoOrders: L2BookHasNoOrders = true;
void _l2BookHasNoOrders;

test("typed subscribe payloads compile", () => {
  expect(true).toBe(true);
});
