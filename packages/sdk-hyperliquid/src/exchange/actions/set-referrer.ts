/**
 * @hyperliquid-api POST /exchange action "setReferrer"
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint.md
 */

import { map, type MpMap } from "../../core/msgpack";

export type SetReferrerAction = {
  readonly type: "setReferrer";
  readonly code: string;
};

export function encodeSetReferrer(action: SetReferrerAction): MpMap {
  return map([
    ["type", action.type],
    ["code", action.code],
  ]);
}
