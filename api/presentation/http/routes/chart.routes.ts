import { Effect } from "effect";
import { ChartDataServiceTag } from "../../../infrastructure/data-sources/binance/chart.provider";
import { TIMEFRAME_LIMITS } from "../../../infrastructure/config/app.config";

export const chartDataRoute = (symbol: string, interval: string, timeframe: string) => {
  const limit = TIMEFRAME_LIMITS[timeframe]?.[interval] || 100;

  return Effect.gen(function* () {
    const service = yield* ChartDataServiceTag;
    return yield* service.getHistoricalData(symbol.toUpperCase(), interval, limit);
  });
};
