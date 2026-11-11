/**
 * @hyperliquid-api POST /exchange action "order"
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint.md
 */

import { map, type MpMap, type MpValue } from "../../core/msgpack";
import type { Address } from "../../core/brands";
import { encodeOrderWire, type Builder, type Grouping, type OrderWire } from "./order-wire";
import { assertNever } from "../response";

export type { Builder, Grouping, OrderTypeWire, OrderWire } from "./order-wire";

export type OrderAction = {
  orders: readonly OrderWire[];
  grouping: Grouping;
  builder?: Builder;
};

export const ORDER_TYPE = "order" as const;

const encodeGrouping = (g: Grouping): MpValue => {
  if (typeof g !== "string") return map([["p", g.p]]);
  switch (g) {
    case "na":
    case "normalTpsl":
    case "positionTpsl":
      return g;
    default:
      return assertNever(g);
  }
};

const encodeBuilderFee = (f: { b: Address; s: number }): MpMap =>
  map([
    ["b", f.b],
    ["s", f.s],
  ]);

const encodeBuilder = (b: Builder): MpMap => {
  const m: [string, MpValue][] = [
    ["b", b.b],
    ["f", b.f],
  ];
  if (b.s !== undefined) m.push(["s", b.s.map(encodeBuilderFee)]);
  return map(m);
};

export function encodeOrder(action: OrderAction): MpMap {
  const m: [string, MpValue][] = [
    ["type", ORDER_TYPE],
    ["orders", action.orders.map(encodeOrderWire)],
    ["grouping", encodeGrouping(action.grouping)],
  ];
  if (action.builder !== undefined) m.push(["builder", encodeBuilder(action.builder)]);
  return map(m);
}
