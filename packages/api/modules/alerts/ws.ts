import type { ServerWebSocket } from "bun";
import type { Notice } from "@0xsignal/shared/alerts";
import { asRecord, stringAt } from "../../shared/parsing";
import type { WsEventHandlers } from "../../platform/http/ws";
import type { AlertsWsConnectionData } from "../../platform/http/ws/upgrade";
import type { AlertsNotifierPort } from "./notifier";
import type { SubjectType } from "./table";

const ALERTS_UNAUTHORIZED_CLOSE_CODE = 4401;
const ALERTS_REPLACED_CLOSE_CODE = 1008;
const ALERTS_MAX_CONNECTIONS_PER_SUBJECT = 2;
/** Outbound bytes that mark a socket full; stays below the transport's 1 MiB cap. */
const ALERTS_WS_BUFFERED_LIMIT_BYTES = 512 * 1024;
const PONG_FRAME = JSON.stringify({ type: "pong" });

type AlertsSocket = ServerWebSocket<AlertsWsConnectionData>;

const subjectTypeOf = (key: string): SubjectType => (key.startsWith("user:") ? "user" : "device");

const helloFrame = (data: AlertsWsConnectionData): string =>
  JSON.stringify({ type: "hello", subject: subjectTypeOf(data.subjectKey) });

const noticeFrame = (notice: Notice): string => JSON.stringify({ type: "notice", notice });

const frameType = (raw: string | Buffer): string | null => {
  try {
    const record = asRecord(JSON.parse(typeof raw === "string" ? raw : raw.toString()));
    return record === null ? null : (stringAt(record, "type") ?? null);
  } catch {
    return null;
  }
};

/**
 * The alerts socket: one notifier subscription per connection, scoped to the
 * subject resolved during the upgrade. All state here is per-process and only
 * touched from Bun socket callbacks, so no locking is needed.
 */
export const createAlertsWsHandlers = (
  notifier: AlertsNotifierPort,
): WsEventHandlers<AlertsWsConnectionData> => {
  const socketsBySubject = new Map<string, AlertsSocket[]>();
  const subscriptions = new Map<AlertsSocket, () => void>();
  const pendingFrames = new Map<AlertsSocket, string[]>();

  const detach = (ws: AlertsSocket): void => {
    const unsubscribe = subscriptions.get(ws);
    if (unsubscribe !== undefined) {
      subscriptions.delete(ws);
      unsubscribe();
    }
    pendingFrames.delete(ws);

    const sockets = socketsBySubject.get(ws.data.subjectKey);
    if (sockets === undefined) return;
    const index = sockets.indexOf(ws);
    if (index !== -1) sockets.splice(index, 1);
    if (sockets.length === 0) socketsBySubject.delete(ws.data.subjectKey);
  };

  const flush = (ws: AlertsSocket): void => {
    const pending = pendingFrames.get(ws);
    if (pending === undefined) return;

    while (
      pending.length > 0 &&
      ws.readyState === 1 &&
      ws.getBufferedAmount() < ALERTS_WS_BUFFERED_LIMIT_BYTES
    ) {
      const next = pending.shift();
      if (next !== undefined) ws.send(next);
    }

    if (pending.length === 0) pendingFrames.delete(ws);
  };

  // Bun reports queued bytes, not frame boundaries, so the drop happens on the
  // frames this handler still owns: while the socket buffer is full, each new
  // frame replaces the oldest pending one instead of growing memory.
  const sendFrame = (ws: AlertsSocket, frame: string): void => {
    if (ws.readyState !== 1) return;
    const pending = pendingFrames.get(ws) ?? [];
    if (ws.getBufferedAmount() >= ALERTS_WS_BUFFERED_LIMIT_BYTES) pending.shift();
    pending.push(frame);
    pendingFrames.set(ws, pending);
    flush(ws);
  };

  const register = (ws: AlertsSocket): void => {
    const { subjectKey } = ws.data;
    // Closing sockets no longer count as concurrent; their own close callback
    // still releases the subscription.
    const sockets = (socketsBySubject.get(subjectKey) ?? []).filter(
      (socket) => socket.readyState === 1,
    );
    sockets.push(ws);
    socketsBySubject.set(subjectKey, sockets);

    if (sockets.length > ALERTS_MAX_CONNECTIONS_PER_SUBJECT) {
      const oldest = sockets.shift();
      oldest?.close(ALERTS_REPLACED_CLOSE_CODE, "connection limit");
    }

    subscriptions.set(
      ws,
      notifier.subscribe(subjectKey, (notice) => {
        sendFrame(ws, noticeFrame(notice));
      }),
    );
    sendFrame(ws, helloFrame(ws.data));
  };

  return {
    open: (ws) => {
      if (subscriptions.has(ws)) return;
      if (typeof ws.data?.subjectKey !== "string" || ws.data.subjectKey === "") {
        ws.close(ALERTS_UNAUTHORIZED_CLOSE_CODE, "Unauthorized");
        return;
      }
      register(ws);
    },
    message: (ws, raw) => {
      if (frameType(raw) !== "ping") return;
      ws.send(PONG_FRAME);
      // Any client traffic is a chance to drain frames held back by pressure.
      if (ws.readyState === 1) flush(ws);
    },
    pong: (ws) => {
      if (ws.readyState === 1) flush(ws);
    },
    close: (ws) => {
      detach(ws);
    },
    error: (ws) => {
      detach(ws);
    },
  };
};
