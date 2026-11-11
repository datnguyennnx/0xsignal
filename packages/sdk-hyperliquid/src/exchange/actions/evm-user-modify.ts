/**
 * @hyperliquid-api POST /exchange action "evmUserModify"
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint.md
 */

import { map, type MpMap } from "../../core/msgpack";

export type EvmUserModifyAction = {
  readonly type: "evmUserModify";
  readonly usingBigBlocks: boolean;
};

export function encodeEvmUserModify(action: EvmUserModifyAction): MpMap {
  return map([
    ["type", action.type],
    ["usingBigBlocks", action.usingBigBlocks],
  ]);
}
