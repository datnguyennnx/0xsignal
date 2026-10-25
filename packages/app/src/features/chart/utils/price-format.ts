import { RAW_PRICE_NSIG_FIGS, formatPriceWithNSigFigs } from "@/core/utils/formatters";

/**
 * The chart's price precision is fixed to the order book's Raw rendering, so the
 * book's precision selector never restyles the price axis, crosshair or tooltip.
 */
export const CHART_PRICE_NSIG_FIGS = RAW_PRICE_NSIG_FIGS;

/** Chart-side price renderer; must stay byte-identical to the orderbook. */
export function formatChartPrice(price: number, nSigFigs: number = CHART_PRICE_NSIG_FIGS): string {
  if (!Number.isFinite(price)) return "—";
  return formatPriceWithNSigFigs(price, nSigFigs);
}
