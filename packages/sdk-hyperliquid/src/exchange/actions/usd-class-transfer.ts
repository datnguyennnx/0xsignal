/**
 * @hyperliquid-api POST /exchange action "usdClassTransfer" (user-signed EIP-712)
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint.md
 */

import { map, type MpMap } from "../../core/msgpack";
import type { Eip712FieldType } from "../../core/eip712";
import { asDecimal, type DecimalString } from "../../core/brands";
import { compareDecimal } from "../../core/decimal";
import { ValidationError } from "../../core/errors";

const ZERO = asDecimal("0");

export type UsdClassTransferAction = {
  amount: DecimalString;
  toPerp: boolean;
  nonce: number;
  hyperliquidChain: "Mainnet" | "Testnet";
  signatureChainId: string;
};

export const USD_CLASS_TRANSFER = {
  type: "usdClassTransfer" as const,
  typeName: "UsdClassTransfer" as const,
  fieldTypes: ["string", "string", "bool", "uint64"] as const satisfies readonly Eip712FieldType[],
  encode: encodeUsdClassTransfer,
} as const;

function encodeUsdClassTransfer(action: UsdClassTransferAction): MpMap {
  if (compareDecimal(action.amount, ZERO) <= 0) {
    throw new ValidationError("action.amount", "positive decimal string");
  }
  return map([
    ["type", USD_CLASS_TRANSFER.type],
    ["amount", action.amount],
    ["toPerp", action.toPerp],
    ["nonce", action.nonce],
  ]);
}
