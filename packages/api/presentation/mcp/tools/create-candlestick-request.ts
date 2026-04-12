import { Effect } from "effect";
import { MarketDataServices } from "../../../application/market-data";

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
    _interactionId?: string;
  }) =>
    Effect.gen(function* () {
      const services = yield* MarketDataServices;
      return yield* services
        .requestCandlesticks({
          id: crypto.randomUUID(),
          symbol: input.symbol,
          exchange: input.exchange ?? "hyperliquid",
          base_timeframe: input.interval,
          start_time: input.start_time,
          end_time: input.end_time,
          requested_by_action_id: input._interactionId,
        })
        .pipe(
          Effect.map((request) => ({
            request_id: request.id,
            symbol: request.symbol,
            interval: request.base_timeframe,
          }))
        );
    }),
};
