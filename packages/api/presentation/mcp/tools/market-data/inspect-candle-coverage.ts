import { Effect } from "effect";
import { MarketDataServices } from "../../../../application/market-data/contracts";
import { isCoverageCompleteStrict } from "../../../../application/market-data/policies";
import { DomainError } from "../../../../application/errors";

const parseIsoDate = (value: string, fieldName: "start_time" | "end_time") => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return Effect.fail(
      new DomainError({
        code: "VALIDATION_ERROR",
        message: `Invalid date for ${fieldName}: ${value}`,
      })
    );
  }
  return Effect.succeed(parsed);
};

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
      const startTime = yield* parseIsoDate(input.start_time, "start_time");
      const endTime = yield* parseIsoDate(input.end_time, "end_time");
      return yield* services
        .inspectCoverage({
          symbol: input.symbol,
          exchange: input.exchange ?? "Hyperliquid",
          timeframe: input.interval,
          startTime,
          endTime,
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
