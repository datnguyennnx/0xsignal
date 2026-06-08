import type { ServerWebSocket } from "bun";
import {
  isRecord,
  type Bucket,
  type MarketWsConnectionData,
  type ServerWebSocketWithBackpressure,
} from "./hub-types";
import { marketWsLog } from "./logging";

export const MAX_BACKPRESSURE_BYTES = 1024 * 1024;

export function broadcast(
  bucket: Bucket,
  payload: unknown,
  detach: (ws: ServerWebSocket<MarketWsConnectionData>) => void
) {
  if (!isRecord(payload)) return;

  if (!bucket.firstMarketBroadcastLogged && payload.type === "market") {
    bucket.firstMarketBroadcastLogged = true;
    marketWsLog("first_market_broadcast", {
      bucketKey: bucket.key,
      channel: bucket.subscription.channel,
      clientsInBucket: bucket.clients.size,
    });
  }

  const encoded = JSON.stringify(payload);
  for (const client of bucket.clients) {
    try {
      const backpressure = (client as unknown as ServerWebSocketWithBackpressure).backpressure ?? 0;
      if (backpressure > MAX_BACKPRESSURE_BYTES) {
        marketWsLog(
          "backpressure_exceeded",
          {
            connectionId: client.data.id,
            bucketKey: bucket.key,
            backpressure,
          },
          "warn"
        );
        client.close(1011, "High backpressure - slow client");
        detach(client);
        continue;
      }
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
