/** Chart Routes */

import { Effect } from "effect";
import { ChartDataServiceTag } from "../../../infrastructure/data-sources/binance/chart.provider";
import {
  CoinGeckoChartServiceTag,
  CoinGeckoService,
} from "../../../infrastructure/data-sources/coingecko";
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

// Ensure Binance format (add USDT if not present)
const toBinanceSymbol = (symbol: string): string => {
  const upper = symbol.toUpperCase();
  if (upper.endsWith("USDT") || upper.endsWith("BUSD")) return upper;
  return `${upper}USDT`;
};

// Try Binance first, fallback to CoinGecko for non-Binance coins
export const chartDataRoute = (symbol: string, interval: string, timeframe: string) => {
  const limit = TIMEFRAME_LIMITS[timeframe]?.[interval] || 100;
  const binanceSymbol = toBinanceSymbol(symbol);
  const baseSymbol = toBaseSymbol(symbol).toLowerCase();

  // Try Binance first
  const binanceChart = Effect.flatMap(ChartDataServiceTag, (s) =>
    s.getHistoricalData(binanceSymbol, interval, limit)
  );

  // Fallback to CoinGecko - resolve coin ID first
  const coinGeckoChart = Effect.gen(function* () {
    const coingecko = yield* CoinGeckoService;
    const chartService = yield* CoinGeckoChartServiceTag;

    // Try to get proper CoinGecko ID from symbol map
    const coinId = yield* coingecko.getCoinId(baseSymbol);
    const resolvedId = coinId ?? baseSymbol;

    return yield* chartService.getHistoricalChart(resolvedId, interval, limit);
  });

  return binanceChart.pipe(
    Effect.catchAll(() => coinGeckoChart),
    Effect.catchTag("DataSourceError", (e) => Effect.fail({ status: 500, message: e.message }))
  );
};
