import { Effect } from "effect";
import { MarketDataServices } from "@application/market-data";

export const createCandlestickRequestTool = {
  name: "create_candlestick_request",
  description: "Request candlestick/market data for a symbol and interval",
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
      requested_by_action_id: { type: "string" },
    },
    required: ["symbol", "interval"],
  },
  execute: (input: {
    symbol: string;
    exchange?: string;
    interval: "1m" | "3m" | "5m" | "15m" | "30m" | "1h" | "2h" | "4h" | "8h" | "12h" | "1d" | "1w";
    start_time?: string;
    end_time?: string;
    requested_by_action_id?: string;
    _interactionId?: string;
    _sessionId?: string;
  }) =>
    Effect.gen(function* () {
      const services = yield* MarketDataServices;
      return yield* services
        .requestCandlesticks({
          id: crypto.randomUUID(),
          session_id: input._sessionId,
          symbol: input.symbol,
          exchange: input.exchange ?? "Hyperliquid",
          base_timeframe: input.interval,
          start_time: input.start_time,
          end_time: input.end_time,
          requested_by_action_id: input.requested_by_action_id,
          requested_by_interaction_id: input._interactionId,
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
