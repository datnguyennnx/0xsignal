/**
 * @hyperliquid-api POST /exchange action "withdraw3" (user-signed EIP-712)
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint.md
 */

import { map, type MpMap } from "../../core/msgpack";
import { ZERO_ADDRESS, type Eip712FieldType } from "../../core/eip712";
import { asDecimal, type Address, type DecimalString } from "../../core/brands";
import { compareDecimal } from "../../core/decimal";
import { ValidationError } from "../../core/errors";

const ZERO = asDecimal("0");

export type WithdrawAction = {
  destination: Address;
  amount: DecimalString;
  time: number;
  hyperliquidChain: "Mainnet" | "Testnet";
  signatureChainId: string;
};

export const WITHDRAW = {
  type: "withdraw3" as const,
  typeName: "Withdraw" as const,
  fieldTypes: [
    "string",
    "string",
    "string",
    "uint64",
  ] as const satisfies readonly Eip712FieldType[],
  encode: encodeWithdraw,
} as const;

function encodeWithdraw(action: WithdrawAction): MpMap {
  if (action.destination.toLowerCase() === ZERO_ADDRESS) {
    throw new ValidationError("action.destination", "non-zero address");
  }
  if (compareDecimal(action.amount, ZERO) <= 0) {
    throw new ValidationError("action.amount", "positive decimal string");
  }
  return map([
    ["type", WITHDRAW.type],
    ["signatureChainId", action.signatureChainId],
    ["hyperliquidChain", action.hyperliquidChain],
    ["destination", action.destination],
    ["amount", action.amount],
    ["time", action.time],
  ]);
}
