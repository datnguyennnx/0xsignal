/**
 * @hyperliquid-api POST /exchange action "trailingStop"
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint.md
 */

import { map, type MpMap } from "../../core/msgpack";
import type { DecimalString } from "../../core/brands";

export type TrailingRetracement = { readonly pct: string } | { readonly px: DecimalString };

export type TrailingStopAction = {
  readonly asset: number;
  readonly isBuy: boolean;
  readonly sz: DecimalString;
  readonly reduceOnly: boolean;
  readonly retracement: TrailingRetracement;
  readonly activationPx: DecimalString | null;
};

export const TRAILING_STOP_TYPE = "trailingStop" as const;

const encodeRetracement = (retracement: TrailingRetracement): MpMap =>
  "pct" in retracement ? map([["pct", retracement.pct]]) : map([["px", retracement.px]]);

export function encodeTrailingStop(action: TrailingStopAction): MpMap {
  return map([
    ["type", TRAILING_STOP_TYPE],
    ["asset", action.asset],
    ["isBuy", action.isBuy],
    ["sz", action.sz],
    ["reduceOnly", action.reduceOnly],
    ["retracement", encodeRetracement(action.retracement)],
    ["activationPx", action.activationPx],
  ]);
}
