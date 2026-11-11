/**
 * @hyperliquid-api POST /exchange action "cDeposit" (user-signed EIP-712)
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint.md
 */

import { map, type MpMap } from "../../core/msgpack";
import type { Eip712FieldType } from "../../core/eip712";

export type CDepositAction = {
  wei: number;
  nonce: number;
};

export const C_DEPOSIT = {
  type: "cDeposit" as const,
  typeName: "CDeposit" as const,
  fieldTypes: ["string", "uint64", "uint64"] as const satisfies readonly Eip712FieldType[],
  encode: encodeCDeposit,
} as const;

export const C_DEPOSIT_TYPE = C_DEPOSIT.type;

function encodeCDeposit(action: CDepositAction): MpMap {
  return map([
    ["type", C_DEPOSIT.type],
    ["wei", action.wei],
    ["nonce", action.nonce],
  ]);
}
