/**
 * @hyperliquid-api POST /exchange action "cWithdraw" (user-signed EIP-712)
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint.md
 */

import { map, type MpMap } from "../../core/msgpack";
import type { Eip712FieldType } from "../../core/eip712";

export type CWithdrawAction = {
  wei: number;
  nonce: number;
};

export const C_WITHDRAW = {
  type: "cWithdraw" as const,
  typeName: "CWithdraw" as const,
  fieldTypes: ["string", "uint64", "uint64"] as const satisfies readonly Eip712FieldType[],
  encode: encodeCWithdraw,
} as const;

export const C_WITHDRAW_TYPE = C_WITHDRAW.type;

function encodeCWithdraw(action: CWithdrawAction): MpMap {
  return map([
    ["type", C_WITHDRAW.type],
    ["wei", action.wei],
    ["nonce", action.nonce],
  ]);
}
