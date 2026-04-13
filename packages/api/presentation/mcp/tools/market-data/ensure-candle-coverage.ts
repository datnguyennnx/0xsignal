import { Effect } from "effect";
import { MarketDataServices } from "@application/market-data";

export const ensureCandleCoverageTool = {
  name: "ensure_candle_coverage",
  description: "Check coverage and fetch missing candles from Hyperliquid if necessary.",
  execute: (input: {
    symbol: string;
    exchange?: string;
    interval: "1m" | "5m" | "15m" | "1h" | "4h" | "1d";
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

      return {
        symbol: input.symbol,
        interval: input.interval,
        rowCount: result.candles.length,
        expectedCount: coverage.expectedCount,
        fullCoverage: coverage.fullCoverage,
        provenance: result.provenance,
        status: coverage.fullCoverage
          ? "Coverage Verified (FULL)"
          : "Coverage Partial (Gaps remaining)",
        missingWindows: coverage.missingWindows,
      };
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
