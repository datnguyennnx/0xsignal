/**
 * @hyperliquid-api POST /exchange action "userDexAbstraction" (user-signed EIP-712)
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint.md
 */

import { map, type MpMap } from "../../core/msgpack";
import type { Eip712FieldType } from "../../core/eip712";
import type { Address } from "../../core/brands";

export type UserDexAbstractionAction = {
  user: Address;
  enabled: boolean;
  nonce: number;
  hyperliquidChain: "Mainnet" | "Testnet";
  signatureChainId: string;
};

export const USER_DEX_ABSTRACTION = {
  type: "userDexAbstraction" as const,
  typeName: "UserDexAbstraction" as const,
  fieldTypes: ["string", "address", "bool", "uint64"] as const satisfies readonly Eip712FieldType[],
  encode: encodeUserDexAbstraction,
} as const;

function encodeUserDexAbstraction(action: UserDexAbstractionAction): MpMap {
  return map([
    ["type", USER_DEX_ABSTRACTION.type],
    ["user", action.user],
    ["enabled", action.enabled],
    ["nonce", action.nonce],
  ]);
}
