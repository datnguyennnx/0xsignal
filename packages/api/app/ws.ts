import { Effect } from "effect";
import type { MarketStreamHubPort, MarketWsConnectionData } from "../modules/market-data";
import {
  createWsEventHandlers,
  MARKET_WS_PATH,
  upgradeMarketWs,
  WS_IDLE_TIMEOUT_SECONDS,
} from "../modules/market-data/ws";
import { asHttpError, type HttpError } from "../platform/http/error-response";
import type { SocketConnection, WsSetup } from "../platform/http/ws";

const toWsHttpError = (error: { readonly message: string }): HttpError =>
  asHttpError(500, error.message);

const socketConnection = (hub: MarketStreamHubPort): SocketConnection<MarketWsConnectionData> => ({
  handleOpen: (ws) => hub.handleOpen(ws).pipe(Effect.mapError(toWsHttpError)),
  handleClose: (ws) => hub.handleClose(ws).pipe(Effect.mapError(toWsHttpError)),
  handleMessage: (ws, raw) => hub.handleMessage(ws, raw).pipe(Effect.mapError(toWsHttpError)),
});

// The transport sees only this opaque setup; the concrete market-data hub is
// adapted here, at the composition root.
export const createWsSetup = (hub: MarketStreamHubPort): WsSetup<MarketWsConnectionData> => ({
  path: MARKET_WS_PATH,
  idleTimeoutSeconds: WS_IDLE_TIMEOUT_SECONDS,
  upgrade: (url, req, server) => upgradeMarketWs(url, req, server, hub),
  handlers: createWsEventHandlers(socketConnection(hub)),
});
