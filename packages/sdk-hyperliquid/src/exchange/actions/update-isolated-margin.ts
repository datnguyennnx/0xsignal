/**
 * @hyperliquid-api POST /exchange action "updateIsolatedMargin"
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint.md
 */

import { map, type MpMap } from "../../core/msgpack";

export type UpdateIsolatedMarginAction = {
  asset: number;
  isBuy: boolean;
  ntli: number;
};

export const UPDATE_ISOLATED_MARGIN_TYPE = "updateIsolatedMargin" as const;

export function encodeUpdateIsolatedMargin(action: UpdateIsolatedMarginAction): MpMap {
  return map([
    ["type", UPDATE_ISOLATED_MARGIN_TYPE],
    ["asset", action.asset],
    ["isBuy", action.isBuy],
    ["ntli", action.ntli],
  ]);
}
