/**
 * @hyperliquid-api POST /exchange (order wire)
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint.md
 */

import { map, type MpMap, type MpValue } from "../../core/msgpack";
import type { Address, Cloid, WirePx, WireSz } from "../../core/brands";
import { assertNever } from "../response";

export type OrderTypeWire =
  | { limit: { tif: "Alo" | "Ioc" | "Gtc" } }
  | { trigger: { isMarket: boolean; triggerPx: WirePx; tpsl: "tp" | "sl" } };

export type OrderWire = {
  a: number;
  b: boolean;
  p: WirePx;
  s: WireSz;
  r: boolean;
  t: OrderTypeWire;
  c?: Cloid;
};

export type Grouping = "na" | "normalTpsl" | "positionTpsl" | { p: number };

export type Builder = { b: Address; f: number; s?: readonly { b: Address; s: number }[] };

export const encodeOrderWireType = (t: OrderTypeWire): MpMap => {
  if ("limit" in t) return map([["limit", map([["tif", t.limit.tif]])]]);
  if ("trigger" in t) {
    const trigger = t.trigger;
    return map([
      [
        "trigger",
        map([
          ["isMarket", trigger.isMarket],
          ["triggerPx", trigger.triggerPx],
          ["tpsl", trigger.tpsl],
        ]),
      ],
    ]);
  }
  return assertNever(t);
};

export const encodeOrderWire = (o: OrderWire): MpMap => {
  const m: [string, MpValue][] = [
    ["a", o.a],
    ["b", o.b],
    ["p", o.p],
    ["s", o.s],
    ["r", o.r],
    ["t", encodeOrderWireType(o.t)],
  ];
  if (o.c !== undefined) m.push(["c", o.c]);
  return map(m);
};
