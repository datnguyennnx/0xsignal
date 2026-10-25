import type { ServerWebSocket } from "bun";
import { Effect } from "effect";
import { MarketStreamError } from "../../../modules/market-data";
import { type Bucket, type MarketWsConnectionData } from "./hub-types";

/**
 * A peer that lets this much sit in its socket buffer is not reading; keeping
 * it would buffer every market frame forever. Close it and let it reconnect.
 */
export const MAX_CLIENT_BUFFER_BYTES = 1024 * 1024;

/**
 * Fire-and-forget broadcast: send every message to every client immediately.
 * A client whose send buffer is over the ceiling, or whose send throws, is
 * detached by the caller. One slow client never delays others.
 */
export function broadcast(
  bucket: Bucket,
  payload: unknown,
  detach: (ws: ServerWebSocket<MarketWsConnectionData>) => void,
) {
  const encoded = JSON.stringify(payload);
  for (const client of bucket.clients) {
    try {
      if (client.getBufferedAmount() > MAX_CLIENT_BUFFER_BYTES) {
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

/** Synchronous sends throw on a dead peer; surface that as a typed port error. */
export const sendFrame = (
  ws: ServerWebSocket<MarketWsConnectionData>,
  payload: unknown,
): Effect.Effect<void, MarketStreamError> =>
  Effect.try({
    try: () => {
      send(ws, payload);
    },
    catch: (cause) =>
      new MarketStreamError({
        message: cause instanceof Error ? cause.message : "socket send failed",
        code: "SEND_FAILED",
        cause,
      }),
  });

export function toText(raw: string | Buffer | Uint8Array): string {
  if (typeof raw === "string") return raw;
  return Buffer.from(raw).toString("utf8");
}
