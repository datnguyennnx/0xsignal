import { expect, test } from "bun:test";
import type { WsClient } from "./client";

export function assertTypedSubscriptionPayloads(ws: WsClient): void {
  ws.subscribe({ type: "l2Book", coin: "BTC" }, (d) => {
    void d.levels[0][0]!.px;
  });
  ws.subscribe({ type: "trades", coin: "BTC" }, (d) => {
    void d[0]!.px;
  });
  ws.subscribe({ type: "l2Book", coin: "BTC" }, (d) => {
    // @ts-expect-error - an l2Book payload has no orders
    void d.orders;
  });
}

test("typed subscribe payloads compile", () => {
  expect(true).toBe(true);
});
