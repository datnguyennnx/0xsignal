/**
 * @hyperliquid-api POST /exchange action "subAccountSpotTransfer"
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint.md
 */

import type { Address, DecimalString } from "../../core/brands";
import { map, type MpMap } from "../../core/msgpack";

export type SubAccountSpotTransferAction = {
  readonly type: "subAccountSpotTransfer";
  readonly subAccountUser: Address;
  readonly isDeposit: boolean;
  readonly token: string;
  readonly amount: DecimalString;
};

export function encodeSubAccountSpotTransfer(action: SubAccountSpotTransferAction): MpMap {
  return map([
    ["type", action.type],
    ["subAccountUser", action.subAccountUser],
    ["isDeposit", action.isDeposit],
    ["token", action.token],
    ["amount", action.amount],
  ]);
}
