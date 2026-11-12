import { hasWalletSession } from "@/lib/wallet-session";

type PnlChartModule = typeof import("@/features/portfolio/components/portfolio-pnl-chart");

/** `/whales/:address` plots a third party's history, so it needs the chunk with no session. */
function isReadOnlyChartRoute(): boolean {
  return typeof window !== "undefined" && window.location.pathname.startsWith("/whales/");
}

/**
 * The lazy `PortfolioPnLChart` loader. Nothing calls it at module evaluation:
 * the overview renders the empty, loading, and error branches from its own
 * chunk, so the chart code is requested only when there is a series to draw.
 * A disconnected wallet has no own chart; the pending promise keeps the 93 KB
 * recharts chunk off the wire when the empty branch is the only outcome.
 */
export const preloadPnlChart = (): Promise<PnlChartModule> => {
  if (!hasWalletSession() && !isReadOnlyChartRoute()) {
    return new Promise<PnlChartModule>(() => {});
  }

  // Warm recharts alongside the chart chunk so the in-component `use()` resolves on first paint.
  void import("recharts");
  return import("@/features/portfolio/components/portfolio-pnl-chart");
};
