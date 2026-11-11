/**
 * @hyperliquid-api POST /exchange action "topUpIsolatedOnlyMargin"
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint.md
 */

import { map, type MpMap } from "../../core/msgpack";
import type { DecimalString } from "../../core/brands";

export type TopUpIsolatedOnlyMarginAction = { asset: number; leverage: DecimalString };

export const TOP_UP_ISOLATED_ONLY_MARGIN_TYPE = "topUpIsolatedOnlyMargin" as const;

export function encodeTopUpIsolatedOnlyMargin(action: TopUpIsolatedOnlyMarginAction): MpMap {
  return map([
    ["type", TOP_UP_ISOLATED_ONLY_MARGIN_TYPE],
    ["asset", action.asset],
    ["leverage", action.leverage],
  ]);
}
