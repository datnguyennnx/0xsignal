import { Effect } from "effect";
import { MarketDataServices, isCoverageCompleteStrict } from "@application/market-data";

export const ensureCandleCoverageTool = {
  name: "ensure_candle_coverage",
  description: "Check coverage and fetch missing candles from Hyperliquid if necessary.",
  execute: (input: {
    symbol: string;
    exchange?: string;
    interval: "1m" | "3m" | "5m" | "15m" | "30m" | "1h" | "2h" | "4h" | "8h" | "12h" | "1d" | "1w";
    start_time: string;
    end_time: string;
  }) =>
    Effect.gen(function* () {
      const services = yield* MarketDataServices;
      const startTime = new Date(input.start_time);
      const endTime = new Date(input.end_time);
      const exchange = input.exchange ?? "Hyperliquid";

      // getCandles now implements gap filling logic AND returns the latest coverage
      const result = yield* services.getCandles({
        symbol: input.symbol,
        exchange,
        timeframe: input.interval,
        startTime,
        endTime,
      });

      const { coverage } = result;
      const isComplete = isCoverageCompleteStrict(coverage);

      return {
        symbol: input.symbol,
        interval: input.interval,
        returnedCandleCount: result.candles.length,
        rowCount: coverage.rowCount,
        expectedCount: coverage.expectedCount,
        fullCoverage: coverage.fullCoverage,
        strictComplete: isComplete,
        provenance: result.provenance,
        status: isComplete ? "Coverage Verified (FULL)" : "Coverage Partial (Gaps remaining)",
        completeness: {
          semantics: "strict",
          complete: isComplete,
          rowCount: coverage.rowCount,
          expectedCount: coverage.expectedCount,
          missingWindowCount: coverage.missingWindows.length,
        },
        missingWindows: coverage.missingWindows,
      };
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
