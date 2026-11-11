/**
 * @hyperliquid-api POST /exchange action "updateLeverage"
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint.md
 */

import { map, type MpMap } from "../../core/msgpack";

export type UpdateLeverageAction = {
  asset: number;
  isCross: boolean;
  leverage: number;
};

export const UPDATE_LEVERAGE_TYPE = "updateLeverage" as const;

export function encodeUpdateLeverage(action: UpdateLeverageAction): MpMap {
  return map([
    ["type", UPDATE_LEVERAGE_TYPE],
    ["asset", action.asset],
    ["isCross", action.isCross],
    ["leverage", action.leverage],
  ]);
}
