/**
 * @hyperliquid-api POST /exchange action "sendAsset" (user-signed EIP-712)
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint.md
 */

import { map, type MpMap } from "../../core/msgpack";
import type { Eip712FieldType } from "../../core/eip712";
import { asDecimal, type Address, type DecimalString } from "../../core/brands";
import { compareDecimal } from "../../core/decimal";
import { ValidationError } from "../../core/errors";

const ZERO = asDecimal("0");

export type SendAssetAction = {
  destination: Address;
  sourceDex: string;
  destinationDex: string;
  token: number;
  amount: DecimalString;
  fromSubAccount: boolean;
  nonce: number;
  hyperliquidChain: "Mainnet" | "Testnet";
  signatureChainId: string;
};

export const SEND_ASSET = {
  type: "sendAsset" as const,
  typeName: "SendAsset" as const,
  fieldTypes: [
    "string",
    "address",
    "string",
    "string",
    "uint64",
    "string",
    "bool",
    "uint64",
  ] as const satisfies readonly Eip712FieldType[],
  encode: encodeSendAsset,
} as const;

function encodeSendAsset(action: SendAssetAction): MpMap {
  if (compareDecimal(action.amount, ZERO) <= 0) {
    throw new ValidationError("action.amount", "positive decimal string");
  }
  return map([
    ["type", SEND_ASSET.type],
    ["destination", action.destination],
    ["sourceDex", action.sourceDex],
    ["destinationDex", action.destinationDex],
    ["token", action.token],
    ["amount", action.amount],
    ["fromSubAccount", action.fromSubAccount],
    ["nonce", action.nonce],
  ]);
}
