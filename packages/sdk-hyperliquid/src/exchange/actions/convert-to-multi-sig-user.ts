/**
 * @hyperliquid-api POST /exchange action "convertToMultiSigUser" (user-signed EIP-712)
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint.md
 */

import { map, type MpMap } from "../../core/msgpack";
import type { Eip712FieldType } from "../../core/eip712";

export type ConvertToMultiSigUserAction = {
  signers: string;
  nonce: number;
  hyperliquidChain: "Mainnet" | "Testnet";
  signatureChainId: string;
};

export const CONVERT_TO_MULTI_SIG_USER = {
  type: "convertToMultiSigUser" as const,
  typeName: "ConvertToMultiSigUser" as const,
  fieldTypes: ["string", "string", "uint64"] as const satisfies readonly Eip712FieldType[],
  encode: encodeConvertToMultiSigUser,
} as const;

function encodeConvertToMultiSigUser(action: ConvertToMultiSigUserAction): MpMap {
  return map([
    ["type", CONVERT_TO_MULTI_SIG_USER.type],
    ["signers", action.signers],
    ["nonce", action.nonce],
  ]);
}
