/**
 * @hyperliquid-api POST /exchange action "userSetAbstraction" (user-signed EIP-712)
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint.md
 */

import { map, type MpMap } from "../../core/msgpack";
import type { Eip712FieldType } from "../../core/eip712";
import type { Address } from "../../core/brands";

export type Abstraction = "disabled" | "unifiedAccount" | "portfolioMargin";

export type UserSetAbstractionAction = {
  user: Address;
  abstraction: Abstraction;
  nonce: number;
};

export const USER_SET_ABSTRACTION = {
  type: "userSetAbstraction" as const,
  typeName: "UserSetAbstraction" as const,
  fieldTypes: [
    "string",
    "address",
    "string",
    "uint64",
  ] as const satisfies readonly Eip712FieldType[],
  encode: encodeUserSetAbstraction,
} as const;

export const USER_SET_ABSTRACTION_TYPE = USER_SET_ABSTRACTION.type;

function encodeUserSetAbstraction(action: UserSetAbstractionAction): MpMap {
  return map([
    ["type", USER_SET_ABSTRACTION.type],
    ["user", action.user],
    ["abstraction", action.abstraction],
    ["nonce", action.nonce],
  ]);
}
