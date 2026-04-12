import { Effect } from "effect";
import { MarketDataServices } from "../../../application/market-data";

export const getCandlesTool = {
  name: "get_candles",
  description:
    "Get candles for a symbol and interval. Uses local cache (QuestDB) first, then fetches from Hyperliquid.",
  execute: (input: {
    symbol: string;
    exchange?: string;
    interval: "1m" | "5m" | "15m" | "1h" | "4h" | "1d";
    start_time?: string;
    end_time?: string;
    limit?: number;
  }) =>
    Effect.gen(function* () {
      const services = yield* MarketDataServices;
      return yield* services.getCandles({
        symbol: input.symbol,
        exchange: input.exchange ?? "Hyperliquid",
        timeframe: input.interval,
        startTime: input.start_time ? new Date(input.start_time) : undefined,
        endTime: input.end_time ? new Date(input.end_time) : undefined,
        limit: input.limit,
      });
    }),
  inputSchema: {
    type: "object",
    properties: {
      symbol: { type: "string", description: "Symbol name e.g. BTC" },
      exchange: { type: "string", description: "Exchange name, defaults to Hyperliquid" },
      interval: { type: "string", enum: ["1m", "5m", "15m", "1h", "4h", "1d"] },
      start_time: { type: "string", description: "ISO timestamp" },
      end_time: { type: "string", description: "ISO timestamp" },
      limit: { type: "number" },
    },
    required: ["symbol", "interval"],
  },
};
