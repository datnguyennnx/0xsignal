/**
 * @hyperliquid-api POST /exchange action "twapCancel"
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint.md
 */

import { map, type MpMap } from "../../core/msgpack";

export type TwapCancelAction = { a: number; t: number };

export const TWAP_CANCEL_TYPE = "twapCancel" as const;

export function encodeTwapCancel(action: TwapCancelAction): MpMap {
  return map([
    ["type", TWAP_CANCEL_TYPE],
    ["a", action.a],
    ["t", action.t],
  ]);
}
