import { formatPriceWithNSigFigs } from "@/core/utils/formatters";

/** Chart-side price renderer; must stay byte-identical to the orderbook. */
export function formatChartPrice(price: number, nSigFigs: number): string {
  if (!Number.isFinite(price)) return "—";
  return formatPriceWithNSigFigs(price, nSigFigs);
}
