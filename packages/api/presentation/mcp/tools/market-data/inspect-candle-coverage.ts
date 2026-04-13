import { Effect } from "effect";
import { MarketDataServices } from "@application/market-data";

export const inspectCandleCoverageTool = {
  name: "inspect_candle_coverage",
  description: "Check how many candles are locally cached in QuestDB for a specific range",
  execute: (input: {
    symbol: string;
    exchange?: string;
    interval: "1m" | "5m" | "15m" | "1h" | "4h" | "1d";
    start_time: string;
    end_time: string;
  }) =>
    Effect.gen(function* () {
      const services = yield* MarketDataServices;
      return yield* services
        .inspectCoverage({
          symbol: input.symbol,
          exchange: input.exchange ?? "Hyperliquid",
          timeframe: input.interval,
          startTime: new Date(input.start_time),
          endTime: new Date(input.end_time),
        })
        .pipe(
          Effect.map((res) => ({
            ...res,
            status: res.fullCoverage
              ? "FULL_COVERAGE"
              : res.hasData
                ? "PARTIAL_COVERAGE"
                : "ZERO_COVERAGE",
            symbol: input.symbol,
            interval: input.interval,
          }))
        );
    }),
  inputSchema: {
    type: "object",
    properties: {
      symbol: { type: "string" },
      exchange: { type: "string" },
      interval: { type: "string", enum: ["1m", "5m", "15m", "1h", "4h", "1d"] },
      start_time: { type: "string" },
      end_time: { type: "string" },
    },
    required: ["symbol", "interval", "start_time", "end_time"],
  },
};
