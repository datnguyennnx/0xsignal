/**
 * @hyperliquid-api POST /exchange action "createSubAccount"
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint.md
 */

import { map, type MpMap } from "../../core/msgpack";

export type CreateSubAccountAction = {
  readonly type: "createSubAccount";
  readonly name: string;
};

export function encodeCreateSubAccount(action: CreateSubAccountAction): MpMap {
  return map([
    ["type", action.type],
    ["name", action.name],
  ]);
}
