/**
 * @hyperliquid-api POST /exchange action "hip3LiquidatorTransfer"
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint.md
 */

import { ValidationError } from "../../core/errors";
import { map, type MpMap } from "../../core/msgpack";

export type Hip3LiquidatorTransferAction = {
  dex: string;
  ntl: number;
  isDeposit: boolean;
};

export const HIP3_LIQUIDATOR_TRANSFER_TYPE = "hip3LiquidatorTransfer" as const;

const NTL_STEP = 1_000_000_000;

const isPositiveStep = (ntl: number): boolean =>
  Number.isSafeInteger(ntl) && ntl > 0 && ntl % NTL_STEP === 0;

export function encodeHip3LiquidatorTransfer(action: Hip3LiquidatorTransferAction): MpMap {
  if (!isPositiveStep(action.ntl)) {
    throw new ValidationError("action.ntl", "positive multiple of 1000000000");
  }
  return map([
    ["type", HIP3_LIQUIDATOR_TRANSFER_TYPE],
    ["dex", action.dex],
    ["ntl", action.ntl],
    ["isDeposit", action.isDeposit],
  ]);
}

export const HIP3_LIQUIDATOR_TRANSFER = encodeHip3LiquidatorTransfer;
