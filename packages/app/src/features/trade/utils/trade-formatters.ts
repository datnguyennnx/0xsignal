import { MAX_SIG_FIGS } from "@/core/utils/formatters";

export { MAX_SIG_FIGS };

export const MAX_DECIMALS_PERP = 6;

export function calculatePxDecimals(szDecimals: number): number {
  return Math.min(MAX_SIG_FIGS, MAX_DECIMALS_PERP - szDecimals);
}
