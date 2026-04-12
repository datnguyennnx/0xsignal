import { Effect } from "effect";
import { getMcpDependencies } from "../server";

export const createCandlestickRequestTool = {
  name: "create_candlestick_request",
  description: "Request candlestick/market data for a symbol and interval",
  inputSchema: {
    type: "object",
    properties: {
      symbol: { type: "string" },
      exchange: { type: "string" },
      interval: { type: "string", enum: ["1m", "5m", "15m", "1h", "4h", "1d", "1w"] },
      start_time: { type: "string" },
      end_time: { type: "string" },
    },
    required: ["symbol", "interval"],
  },
  execute: (input: {
    symbol: string;
    exchange?: string;
    interval: "1m" | "5m" | "15m" | "1h" | "4h" | "1d" | "1w";
    start_time?: string;
    end_time?: string;
  }) => {
    const deps = getMcpDependencies();
    return deps.marketDataServices
      .requestCandlesticks({
        id: crypto.randomUUID(),
        symbol: input.symbol,
        exchange: input.exchange ?? "binance",
        base_timeframe: input.interval,
        start_time: input.start_time,
        end_time: input.end_time,
      })
      .pipe(
        Effect.map((request) => ({
          request_id: request.id,
          symbol: request.symbol,
          interval: request.base_timeframe,
        }))
      );
  },
};
