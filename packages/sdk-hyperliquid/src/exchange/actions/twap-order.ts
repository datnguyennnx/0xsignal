/**
 * @hyperliquid-api POST /exchange action "twapOrder"
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint.md
 */

import { map, type MpMap } from "../../core/msgpack";
import type { WireSz } from "../../core/brands";

type TwapOrderWire = {
  a: number;
  b: boolean;
  s: WireSz;
  r: boolean;
  m: number;
  t: boolean;
};

export type TwapOrderAction = { twap: TwapOrderWire };

export const TWAP_ORDER_TYPE = "twapOrder" as const;

const encodeTwapWire = (t: TwapOrderWire): MpMap =>
  map([
    ["a", t.a],
    ["b", t.b],
    ["s", t.s],
    ["r", t.r],
    ["m", t.m],
    ["t", t.t],
  ]);

export function encodeTwapOrder(action: TwapOrderAction): MpMap {
  return map([
    ["type", TWAP_ORDER_TYPE],
    ["twap", encodeTwapWire(action.twap)],
  ]);
}
