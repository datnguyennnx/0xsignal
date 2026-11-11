/**
 * @hyperliquid-api POST /exchange action "reserveRequestWeight"
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint.md
 */

import { map, type MpMap, type MpValue } from "../../core/msgpack";
import type { Address } from "../../core/brands";

export type ReserveRequestWeightAction = {
  readonly weight: number;
  readonly destination?: Address;
};

export const RESERVE_REQUEST_WEIGHT_TYPE = "reserveRequestWeight" as const;

export function encodeReserveRequestWeight(action: ReserveRequestWeightAction): MpMap {
  const pairs: (readonly [string, MpValue])[] = [
    ["type", RESERVE_REQUEST_WEIGHT_TYPE],
    ["weight", action.weight],
  ];
  if (action.destination !== undefined) pairs.push(["destination", action.destination]);
  return map(pairs);
}
