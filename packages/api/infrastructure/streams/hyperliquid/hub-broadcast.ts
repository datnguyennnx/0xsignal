import type { ServerWebSocket } from "bun";
import { type Bucket, type MarketWsConnectionData } from "./hub-types";

/**
 * Fire-and-forget broadcast: send every message to every client immediately.
 * If a client's send buffer is full or the connection is dead, drop silently
 * for that client. One slow client never delays others.
 */
export function broadcast(
  bucket: Bucket,
  payload: unknown,
  detach: (ws: ServerWebSocket<MarketWsConnectionData>) => void,
) {
  const encoded = JSON.stringify(payload);
  for (const client of bucket.clients) {
    try {
      client.send(encoded);
    } catch {
      detach(client);
    }
  }
}

export function send(ws: ServerWebSocket<MarketWsConnectionData>, payload: unknown) {
  ws.send(JSON.stringify(payload));
}

export function toText(raw: string | Buffer | Uint8Array): string {
  if (typeof raw === "string") return raw;
  return Buffer.from(raw).toString("utf8");
}
