/**
 * @hyperliquid-api POST /exchange action "tokenDelegate" (user-signed EIP-712)
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint.md
 */

import { map, type MpMap } from "../../core/msgpack";
import type { Eip712FieldType } from "../../core/eip712";
import type { Address } from "../../core/brands";

export type TokenDelegateAction = {
  validator: Address;
  wei: number;
  isUndelegate: boolean;
  nonce: number;
  hyperliquidChain: "Mainnet" | "Testnet";
  signatureChainId: string;
};

export const TOKEN_DELEGATE = {
  type: "tokenDelegate" as const,
  typeName: "TokenDelegate" as const,
  fieldTypes: [
    "string",
    "address",
    "uint64",
    "bool",
    "uint64",
  ] as const satisfies readonly Eip712FieldType[],
  encode: encodeTokenDelegate,
} as const;

function encodeTokenDelegate(action: TokenDelegateAction): MpMap {
  return map([
    ["type", TOKEN_DELEGATE.type],
    ["validator", action.validator],
    ["wei", action.wei],
    ["isUndelegate", action.isUndelegate],
    ["nonce", action.nonce],
  ]);
}
