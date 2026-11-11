/**
 * @hyperliquid-api POST /exchange action "modify"
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint.md
 */

import { map, type MpMap, type MpValue } from "../../core/msgpack";
import { encodeOrderWire, type OrderWire } from "./order-wire";

export type { OrderWire } from "./order-wire";

export type ModifyAction = {
  oid: number | string;
  order: OrderWire;
  a?: number;
};

export const MODIFY_TYPE = "modify" as const;

export function encodeModify(action: ModifyAction): MpMap {
  const m: [string, MpValue][] = [
    ["type", MODIFY_TYPE],
    ["oid", action.oid],
    ["order", encodeOrderWire(action.order)],
  ];
  if (action.a !== undefined) m.push(["a", action.a]);
  return map(m);
}
