/**
 * @hyperliquid-api POST /exchange action "batchModify"
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint.md
 */

import { map, type MpMap, type MpValue } from "../../core/msgpack";
import { encodeOrderWire, type OrderWire } from "./order-wire";

export type { OrderTypeWire, OrderWire } from "./order-wire";

type ModifyOrderWire = { oid: number | string; order: OrderWire };

export type BatchModifyAction = {
  modifies: readonly ModifyOrderWire[];
  a?: number;
};

export const BATCH_MODIFY_TYPE = "batchModify" as const;

const encodeModifyWire = (w: ModifyOrderWire): MpMap =>
  map([
    ["oid", w.oid],
    ["order", encodeOrderWire(w.order)],
  ]);

export function encodeBatchModify(action: BatchModifyAction): MpMap {
  const m: [string, MpValue][] = [
    ["type", BATCH_MODIFY_TYPE],
    ["modifies", action.modifies.map(encodeModifyWire)],
  ];
  if (action.a !== undefined) m.push(["a", action.a]);
  return map(m);
}
