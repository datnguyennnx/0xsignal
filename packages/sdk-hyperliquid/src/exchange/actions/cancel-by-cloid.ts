/**
 * @hyperliquid-api POST /exchange action "cancelByCloid"
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint.md
 */

import { map, type MpMap, type MpValue } from "../../core/msgpack";
import type { Cloid } from "../../core/brands";

type CancelByCloidWire = { asset: number; cloid: Cloid };

export type CancelByCloidAction = {
  cancels: readonly CancelByCloidWire[];
  f?: true;
};

export const CANCEL_BY_CLOID_TYPE = "cancelByCloid" as const;

const encodeCancelByCloidWire = (c: CancelByCloidWire): MpMap =>
  map([
    ["asset", c.asset],
    ["cloid", c.cloid],
  ]);

export function encodeCancelByCloid(action: CancelByCloidAction): MpMap {
  const m: [string, MpValue][] = [
    ["type", CANCEL_BY_CLOID_TYPE],
    ["cancels", action.cancels.map(encodeCancelByCloidWire)],
  ];
  if (action.f === true) m.push(["f", true]);
  return map(m);
}
