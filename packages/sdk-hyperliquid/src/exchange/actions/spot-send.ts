/**
 * @hyperliquid-api POST /exchange action "spotSend" (user-signed EIP-712)
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint.md
 */

import { map, type MpMap } from "../../core/msgpack";
import type { Eip712FieldType } from "../../core/eip712";
import { asDecimal, type Address, type DecimalString } from "../../core/brands";
import { compareDecimal } from "../../core/decimal";
import { ValidationError } from "../../core/errors";

const ZERO = asDecimal("0");

export type SpotSendAction = {
  destination: Address;
  token: string;
  amount: DecimalString;
  time: number;
  hyperliquidChain: "Mainnet" | "Testnet";
  signatureChainId: string;
};

export const SPOT_SEND = {
  type: "spotSend" as const,
  typeName: "SpotSend" as const,
  fieldTypes: [
    "string",
    "address",
    "string",
    "string",
    "uint64",
  ] as const satisfies readonly Eip712FieldType[],
  encode: encodeSpotSend,
} as const;

function encodeSpotSend(action: SpotSendAction): MpMap {
  if (compareDecimal(action.amount, ZERO) <= 0) {
    throw new ValidationError("action.amount", "positive decimal string");
  }
  return map([
    ["type", SPOT_SEND.type],
    ["destination", action.destination],
    ["token", action.token],
    ["amount", action.amount],
    ["time", action.time],
  ]);
}
