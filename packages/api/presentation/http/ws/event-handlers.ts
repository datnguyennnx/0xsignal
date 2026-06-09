import type { ServerWebSocket } from "bun";
import { Effect } from "effect";
import type {
  MarketWsConnectionData,
  MarketStreamHubPort,
} from "../../../infrastructure/streams/hyperliquid/hub";

/**
 * Creates WebSocket event handlers (open / message / close) wired to the given
 * MarketStreamHub. Each callback fires `Effect.runPromise` to bridge the Bun WS
 * callback boundary into Effect — errors are logged to console.error at the
 * Edge of the World.
 */
export const createWsEventHandlers = (marketStreamHub: MarketStreamHubPort) => ({
  open(ws: ServerWebSocket<MarketWsConnectionData>) {
    Effect.runPromise(marketStreamHub.handleOpen(ws)).catch((err) => {
      // Edge of the World — Bun WS callback outside Effect context
      console.error("[WS Open Error]:", err);
    });
  },
  message(ws: ServerWebSocket<MarketWsConnectionData>, message: string | Buffer) {
    Effect.runPromise(marketStreamHub.handleMessage(ws, message)).catch((err) => {
      // Edge of the World — Bun WS callback outside Effect context
      console.error("[WS Message Error]:", err);
    });
  },
  close(ws: ServerWebSocket<MarketWsConnectionData>) {
    Effect.runPromise(marketStreamHub.handleClose(ws)).catch((err) => {
      // Edge of the World — Bun WS callback outside Effect context
      console.error("[WS Close Error]:", err);
    });
  },
});
