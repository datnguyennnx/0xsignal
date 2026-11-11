/**
 * @hyperliquid-api POST /exchange action "cancel"
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint.md
 */

import { map, type MpMap, type MpValue } from "../../core/msgpack";

type CancelWire = { a: number; o: number };

export type CancelAction = { cancels: readonly CancelWire[]; f?: true };

export const CANCEL_TYPE = "cancel" as const;

const encodeCancelWire = (c: CancelWire): MpMap =>
  map([
    ["a", c.a],
    ["o", c.o],
  ]);

export function encodeCancel(action: CancelAction): MpMap {
  const m: [string, MpValue][] = [
    ["type", CANCEL_TYPE],
    ["cancels", action.cancels.map(encodeCancelWire)],
  ];
  if (action.f === true) m.push(["f", true]);
  return map(m);
}
