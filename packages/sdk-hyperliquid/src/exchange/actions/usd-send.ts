/**
 * @hyperliquid-api POST /exchange action "usdSend" (user-signed EIP-712)
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint.md
 */

import { map, type MpMap } from "../../core/msgpack";
import type { Eip712FieldType } from "../../core/eip712";
import { asDecimal, type Address, type DecimalString } from "../../core/brands";
import { compareDecimal } from "../../core/decimal";
import { ValidationError } from "../../core/errors";

const ZERO = asDecimal("0");

export type UsdSendAction = {
  destination: Address;
  amount: DecimalString;
  time: number;
  hyperliquidChain: "Mainnet" | "Testnet";
  signatureChainId: string;
};

export const USD_SEND = {
  type: "usdSend" as const,
  typeName: "UsdSend" as const,
  fieldTypes: [
    "string",
    "address",
    "string",
    "uint64",
  ] as const satisfies readonly Eip712FieldType[],
  encode: encodeUsdSend,
} as const;

function encodeUsdSend(action: UsdSendAction): MpMap {
  if (compareDecimal(action.amount, ZERO) <= 0) {
    throw new ValidationError("action.amount", "positive decimal string");
  }
  return map([
    ["type", USD_SEND.type],
    ["destination", action.destination],
    ["amount", action.amount],
    ["time", action.time],
  ]);
}
