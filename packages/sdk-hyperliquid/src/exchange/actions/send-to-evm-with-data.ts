/**
 * @hyperliquid-api POST /exchange action "sendToEvmWithData" (user-signed EIP-712)
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint.md
 */

import { map, type MpMap } from "../../core/msgpack";
import type { Eip712FieldType } from "../../core/eip712";
import type { Address, DecimalString, Hex } from "../../core/brands";

export type SendToEvmWithDataAction = {
  hyperliquidChain: "Mainnet" | "Testnet";
  token: string;
  amount: DecimalString;
  sourceDex: string;
  destinationRecipient: Address;
  addressEncoding: "hex" | "base58";
  destinationChainId: number;
  gasLimit: number;
  data: Hex;
  nonce: number;
  signatureChainId: string;
};

export const SEND_TO_EVM_WITH_DATA = {
  type: "sendToEvmWithData" as const,
  typeName: "SendToEvmWithData" as const,
  fieldTypes: [
    "string",
    "string",
    "string",
    "string",
    "string",
    "string",
    "uint32",
    "uint64",
    "bytes",
    "uint64",
  ] as const satisfies readonly Eip712FieldType[],
  encode: encodeSendToEvmWithData,
} as const;

export const SEND_TO_EVM_WITH_DATA_TYPE = SEND_TO_EVM_WITH_DATA.type;

function encodeSendToEvmWithData(action: SendToEvmWithDataAction): MpMap {
  return map([
    ["type", SEND_TO_EVM_WITH_DATA.type],
    ["hyperliquidChain", action.hyperliquidChain],
    ["token", action.token],
    ["amount", action.amount],
    ["sourceDex", action.sourceDex],
    ["destinationRecipient", action.destinationRecipient],
    ["addressEncoding", action.addressEncoding],
    ["destinationChainId", action.destinationChainId],
    ["gasLimit", action.gasLimit],
    ["data", action.data],
    ["nonce", action.nonce],
  ]);
}
