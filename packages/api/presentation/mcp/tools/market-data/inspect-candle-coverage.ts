import { Effect } from "effect";
import { MarketDataServices, isCoverageCompleteStrict } from "@application/market-data";

export const inspectCandleCoverageTool = {
  name: "inspect_candle_coverage",
  description: "Check how many candles are locally cached in QuestDB for a specific range",
  execute: (input: {
    symbol: string;
    exchange?: string;
    interval: "1m" | "3m" | "5m" | "15m" | "30m" | "1h" | "2h" | "4h" | "8h" | "12h" | "1d" | "1w";
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
            status: isCoverageCompleteStrict(res)
              ? "FULL_COVERAGE"
              : res.hasData
                ? "PARTIAL_COVERAGE"
                : "ZERO_COVERAGE",
            completeness: {
              semantics: "strict",
              complete: isCoverageCompleteStrict(res),
              rowCount: res.rowCount,
              expectedCount: res.expectedCount,
              missingWindowCount: res.missingWindows.length,
            },
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
      interval: {
        type: "string",
        enum: ["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "8h", "12h", "1d", "1w"],
      },
      start_time: { type: "string" },
      end_time: { type: "string" },
    },
    required: ["symbol", "interval", "start_time", "end_time"],
  },
};
