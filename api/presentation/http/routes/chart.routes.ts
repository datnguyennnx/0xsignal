/** Chart Routes */

import { Effect } from "effect";
import { ChartDataServiceTag } from "../../../infrastructure/data-sources/binance/chart.provider";
import { TIMEFRAME_LIMITS } from "../../../infrastructure/config/app.config";

export const chartDataRoute = (symbol: string, interval: string, timeframe: string) => {
  const limit = TIMEFRAME_LIMITS[timeframe]?.[interval] || 100;
  return Effect.flatMap(ChartDataServiceTag, (s) =>
    s.getHistoricalData(symbol.toUpperCase(), interval, limit)
  ).pipe(
    Effect.catchTag("DataSourceError", (e) => Effect.fail({ status: 500, message: e.message }))
  );
};
