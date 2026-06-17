export const MAX_DECIMALS_PERP = 6;
export const MAX_SIG_FIGS = 5;

export function calculatePxDecimals(szDecimals: number): number {
  return Math.min(MAX_SIG_FIGS, MAX_DECIMALS_PERP - szDecimals);
}
