import { Effect } from "effect";
import { MarketDataServices } from "@application/market-data";

const parseOptionalIsoDate = (
  value: string | undefined,
  fieldName: "start_time" | "end_time"
): Effect.Effect<Date | undefined, Error> => {
  if (!value) {
    return Effect.succeed(undefined);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return Effect.fail(new Error(`Invalid date for ${fieldName}: ${value}`));
  }
  return Effect.succeed(parsed);
};

export const getCandlesTool = {
  name: "get_candles",
  description:
    "Get candles for a symbol and interval using the canonical historical/reconciled backend path.",
  execute: (input: {
    symbol: string;
    exchange?: string;
    interval: "1m" | "3m" | "5m" | "15m" | "30m" | "1h" | "2h" | "4h" | "8h" | "12h" | "1d" | "1w";
    start_time?: string;
    end_time?: string;
    limit?: number;
  }) =>
    Effect.gen(function* () {
      const services = yield* MarketDataServices;
      const symbol = input.symbol.trim();
      if (!symbol) {
        return yield* Effect.fail(new Error("symbol is required"));
      }

      const startTime = yield* parseOptionalIsoDate(input.start_time, "start_time");
      const endTime = yield* parseOptionalIsoDate(input.end_time, "end_time");

      if (input.limit !== undefined && (!Number.isInteger(input.limit) || input.limit <= 0)) {
        return yield* Effect.fail(new Error("limit must be a positive integer"));
      }

      return yield* services.getCandles({
        symbol,
        exchange: input.exchange ?? "Hyperliquid",
        timeframe: input.interval,
        startTime,
        endTime,
        limit: input.limit,
      });
    }),
  inputSchema: {
    type: "object",
    properties: {
      symbol: { type: "string", description: "Symbol name e.g. BTC" },
      exchange: { type: "string", description: "Exchange name, defaults to Hyperliquid" },
      interval: {
        type: "string",
        enum: ["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "8h", "12h", "1d", "1w"],
      },
      start_time: { type: "string", description: "ISO timestamp" },
      end_time: { type: "string", description: "ISO timestamp" },
      limit: { type: "integer", minimum: 1 },
    },
    required: ["symbol", "interval"],
  },
};
