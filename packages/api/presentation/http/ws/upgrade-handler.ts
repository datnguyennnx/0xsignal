import type { Server } from "bun";
import type { MarketStreamHubPort } from "../../../infrastructure/streams/hyperliquid/hub";
import { parseMarketWsSubscription } from "./subscription-parser";

/**
 * Handles WebSocket upgrade for a given URL.
 *
 * - Returns `undefined` if `url` is not a WS path or the upgrade succeeded.
 * - Returns a `Response` with error details when validation or upgrade fails.
 *
 * When `undefined` is returned for a non-WS path, the caller should continue
 * to HTTP routing. When `undefined` is returned after a successful upgrade,
 * Bun's Server handles the rest — the fetch handler must return `undefined`.
 */
export const handleWsUpgrade = (
  url: URL,
  req: Request,
  server: Server<unknown>,
  marketStreamHub: MarketStreamHubPort
): Response | undefined => {
  if (url.pathname !== "/api/ws/market") return undefined;

  const parsed = parseMarketWsSubscription(url.searchParams);
  if (!parsed.ok) {
    return new Response(JSON.stringify({ error: parsed.message, status: parsed.status }), {
      status: parsed.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  const upgraded = server.upgrade(req, {
    data: marketStreamHub.createConnectionData(parsed.data),
  });

  if (upgraded) return undefined;

  return new Response(JSON.stringify({ error: "WebSocket upgrade failed", status: 400 }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
};
