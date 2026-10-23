import type {
  MarketStreamHubPort,
  MarketWsConnectionData,
} from "../../../application/market-data/market-stream.contracts";
import { parseMarketWsSubscription } from "../../../application/market-data/subscription-parser";

/** The slice of Bun's `Server` this handler needs, which keeps it testable. */
export type WsUpgradeServer = {
  readonly upgrade: (req: Request, options: { readonly data: MarketWsConnectionData }) => boolean;
};

/**
 * Handles WebSocket upgrade for a given URL.
 *
 * - Returns `undefined` if `url` is not a WS path or the upgrade succeeded.
 * - Returns a `Response` with error details when validation or upgrade fails.
 *
 * A socket without a `channel` is legal: it starts with zero subscriptions and
 * registers them through `subscribe` frames.
 *
 * When `undefined` is returned for a non-WS path, the caller should continue
 * to HTTP routing. When `undefined` is returned after a successful upgrade,
 * Bun's Server handles the rest — the fetch handler must return `undefined`.
 */
export const handleWsUpgrade = (
  url: URL,
  req: Request,
  server: WsUpgradeServer,
  marketStreamHub: MarketStreamHubPort,
): Response | undefined => {
  if (url.pathname !== "/api/ws/market") return undefined;

  const channel = (url.searchParams.get("channel") ?? url.searchParams.get("type") ?? "").trim();
  const parsed = channel === "" ? undefined : parseMarketWsSubscription(url.searchParams);
  if (parsed !== undefined && !parsed.ok) {
    return new Response(JSON.stringify({ error: parsed.message, status: parsed.status }), {
      status: parsed.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  const upgraded = server.upgrade(req, {
    data: marketStreamHub.createConnectionData(parsed?.data),
  });

  if (upgraded) return undefined;

  return new Response(JSON.stringify({ error: "WebSocket upgrade failed", status: 400 }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
};
