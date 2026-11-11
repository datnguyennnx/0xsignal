/**
 * @hyperliquid-api POST /exchange action "subAccountTransfer"
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint.md
 */

import type { Address } from "../../core/brands";
import { map, type MpMap } from "../../core/msgpack";

export type SubAccountTransferAction = {
  readonly type: "subAccountTransfer";
  readonly subAccountUser: Address;
  readonly isDeposit: boolean;
  readonly usd: number;
};

export function encodeSubAccountTransfer(action: SubAccountTransferAction): MpMap {
  return map([
    ["type", action.type],
    ["subAccountUser", action.subAccountUser],
    ["isDeposit", action.isDeposit],
    ["usd", action.usd],
  ]);
}
