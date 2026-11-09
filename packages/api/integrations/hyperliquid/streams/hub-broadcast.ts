import type { ServerWebSocket } from "bun";
import { Effect } from "effect";
import { MarketStreamError } from "../../../modules/market-data";
import { type Bucket, closeQuietly, type MarketWsConnectionData } from "./hub-types";

/**
 * A peer that lets this much sit in its socket buffer is not reading; keeping
 * it would buffer every market frame forever. Close it and let it reconnect.
 */
export const MAX_CLIENT_BUFFER_BYTES = 1024 * 1024;

type Detach = (ws: ServerWebSocket<MarketWsConnectionData>) => void;

const noopDetach: Detach = () => {};

/**
 * Sends one already-encoded frame and reports whether the peer accepted it.
 * Bun's `send` returns a status instead of throwing on a dead peer: `0` means
 * the frame was dropped and `-1` means backpressure. Both are treated like an
 * over-buffered peer and handed to the detach path. A thrown send propagates;
 * callers decide whether that is a detach or a typed error.
 */
const safeSend = (
  ws: ServerWebSocket<MarketWsConnectionData>,
  encoded: string,
  onDetach: Detach,
): boolean => {
  if (ws.getBufferedAmount() > MAX_CLIENT_BUFFER_BYTES) {
    onDetach(ws);
    return false;
  }
  if (ws.send(encoded) <= 0) {
    onDetach(ws);
    return false;
  }
  return true;
};

/**
 * Fire-and-forget broadcast: send every message to every client immediately.
 * A client whose send buffer is over the ceiling, whose send reports a drop
 * or backpressure, or whose send throws, is detached by the caller. One slow
 * client never delays others. Returns the number of frames the socket layer
 * accepted, so a dropped frame is not counted as delivered.
 */
export function broadcast(bucket: Bucket, payload: unknown, detach: Detach): number {
  const encoded = JSON.stringify(payload);
  let delivered = 0;
  for (const client of bucket.clients) {
    try {
      if (safeSend(client, encoded, detach)) delivered += 1;
    } catch {
      detach(client);
    }
  }
  return delivered;
}

/**
 * Sends one control frame through the same status-aware path as broadcast.
 * Control frames carry no bucket key, so a dropped, backpressured, or
 * over-buffered socket is closed through the hub's quiet-close helper instead
 * of being left registered. A thrown send still propagates; callers that want
 * fire-and-forget semantics swallow it.
 */
export function send(ws: ServerWebSocket<MarketWsConnectionData>, payload: unknown): void {
  const encoded = JSON.stringify(payload);
  safeSend(ws, encoded, (target) => {
    closeQuietly(target, 1013, "client too slow");
  });
}

/**
 * Sends one control frame through the same status-aware path as broadcast.
 * Direct frames have no bucket to detach from yet, so callers may supply the
 * detach callback; JSON/send exceptions still surface as a typed port error.
 */
export const sendFrame = (
  ws: ServerWebSocket<MarketWsConnectionData>,
  payload: unknown,
  onDetach: Detach = noopDetach,
): Effect.Effect<void, MarketStreamError> =>
  Effect.try({
    try: () => {
      safeSend(ws, JSON.stringify(payload), onDetach);
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
