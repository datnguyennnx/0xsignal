/** Chart Routes - Uses Hyperliquid for chart data */

import { Effect } from "effect";
import { HyperliquidChartService } from "../../../infrastructure/data-sources/hyperliquid";
import { TIMEFRAME_LIMITS } from "../../../infrastructure/config/app.config";
import { DataSourceError } from "../../../infrastructure/data-sources/types";

// Extract base symbol (strip USDT/BUSD suffix if present)
const toBaseSymbol = (symbol: string): string => {
  const upper = symbol.toUpperCase();
  if (upper.endsWith("USDT")) return upper.slice(0, -4);
  if (upper.endsWith("BUSD")) return upper.slice(0, -4);
  if (upper.endsWith("USD")) return upper.slice(0, -3);
  return upper;
};

// Ensure Hyperliquid format (add USDT if not present)
const toHyperliquidSymbol = (symbol: string): string => {
  const upper = symbol.toUpperCase();
  if (upper.endsWith("USDT") || upper.endsWith("BUSD")) return upper;
  return `${upper}USDT`;
};

// Use Hyperliquid for chart data
export const chartDataRoute = (symbol: string, interval: string, timeframe: string) => {
  const limit = TIMEFRAME_LIMITS[timeframe]?.[interval] || 100;
  const hlSymbol = toHyperliquidSymbol(symbol);

  const hyperliquidChart = Effect.flatMap(HyperliquidChartService, (s) =>
    s.getHistoricalData(hlSymbol, interval, limit)
  );

  return hyperliquidChart.pipe(
    Effect.catchTag("DataSourceError", (e) => Effect.fail({ status: 500, message: e.message }))
  );
};
