/**
 * @hyperliquid-api POST /exchange action "approveBuilderFee" (user-signed EIP-712)
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint.md
 */

import { map, type MpMap } from "../../core/msgpack";
import type { Eip712FieldType } from "../../core/eip712";
import type { Address } from "../../core/brands";
import { ValidationError } from "../../core/errors";

const MAX_FEE_TENTHS = 1_000;

const feeTenths = (rate: string): number => {
  const match = /^(\d+)(?:\.(\d{1,3}))?%$/.exec(rate);
  if (match === null) {
    throw new ValidationError("action.maxFeeRate", "percent with at most 3 decimals");
  }
  const tenths = Number(match[1]) * 1_000 + Number((match[2] ?? "").padEnd(3, "0"));
  if (!Number.isSafeInteger(tenths) || tenths > MAX_FEE_TENTHS) {
    throw new ValidationError("action.maxFeeRate", "percent at or below 1%");
  }
  return tenths;
};

export type ApproveBuilderFeeAction = {
  maxFeeRate: string;
  builder: Address;
  nonce: number;
  hyperliquidChain: "Mainnet" | "Testnet";
  signatureChainId: string;
};

export const APPROVE_BUILDER_FEE = {
  type: "approveBuilderFee" as const,
  typeName: "ApproveBuilderFee" as const,
  fieldTypes: [
    "string",
    "string",
    "address",
    "uint64",
  ] as const satisfies readonly Eip712FieldType[],
  encode: encodeApproveBuilderFee,
} as const;

function encodeApproveBuilderFee(action: ApproveBuilderFeeAction): MpMap {
  feeTenths(action.maxFeeRate);
  return map([
    ["type", APPROVE_BUILDER_FEE.type],
    ["maxFeeRate", action.maxFeeRate],
    ["builder", action.builder],
    ["nonce", action.nonce],
  ]);
}
