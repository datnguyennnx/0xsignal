/**
 * Warms the chart chunk. The chart is above-the-fold in the trade layout, so the
 * route commits this in parallel with its data instead of waiting for the lazy
 * boundary to paint a fallback.
 */
export const preloadChartChunk = () => import("@/features/chart/components/trading-chart");
