import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { API_BASE } from "@/lib/api-base";
import { queryKeys } from "@/lib/query-keys";

const ALERT_STREAM_PATH = "/ws/alerts";
const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 30_000;
/** The server's "not authenticated" close: retrying cannot succeed until login. */
const UNAUTHORIZED_CLOSE_CODE = 4401;
const SEEN_NOTICE_LIMIT = 100;

export type AlertSeverity = "info" | "warn" | "critical";

export interface AlertNotice {
  ruleName: string;
  severity: AlertSeverity;
  summary: string;
  firedAt: number;
  payload: Record<string, unknown>;
}

export type AlertStreamFrame =
  | { kind: "hello"; subject: string }
  | { kind: "notice"; notice: AlertNotice }
  | { kind: "other" };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isSeverity = (value: unknown): value is AlertSeverity =>
  value === "info" || value === "warn" || value === "critical";

const toNotice = (value: unknown): AlertNotice | null => {
  if (!isRecord(value)) return null;

  const { ruleName, severity, summary, firedAt, payload } = value;
  if (typeof ruleName !== "string" || typeof summary !== "string") return null;
  if (typeof firedAt !== "number" || !Number.isFinite(firedAt) || !isSeverity(severity)) {
    return null;
  }

  return {
    ruleName,
    severity,
    summary,
    firedAt,
    payload: isRecord(payload) ? payload : {},
  };
};

/** Wire frames are strings; anything unreadable is ignored rather than crashing the stream. */
export function decodeAlertFrame(data: unknown): AlertStreamFrame {
  if (typeof data !== "string") return { kind: "other" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return { kind: "other" };
  }

  if (!isRecord(parsed)) return { kind: "other" };
  if (parsed["type"] === "hello" && typeof parsed["subject"] === "string") {
    return { kind: "hello", subject: parsed["subject"] };
  }
  if (parsed["type"] === "notice") {
    const notice = toNotice(parsed["notice"]);
    if (notice !== null) return { kind: "notice", notice };
  }

  return { kind: "other" };
}

export interface NoticeLedger {
  accept: (notice: AlertNotice) => boolean;
}

/**
 * A notice is one (rule, fire time) event. The server may replay it after a
 * reconnect, so the client keeps a bounded history and forwards each pair once.
 */
export function createNoticeLedger(limit = SEEN_NOTICE_LIMIT): NoticeLedger {
  const seen = new Set<string>();
  const order: string[] = [];

  return {
    accept(notice) {
      const key = `${notice.ruleName}\u0000${notice.firedAt}`;
      if (seen.has(key)) return false;

      seen.add(key);
      order.push(key);
      const oldest = order.length > limit ? order.shift() : undefined;
      if (oldest !== undefined) seen.delete(oldest);

      return true;
    },
  };
}

interface StreamLocation {
  readonly protocol: string;
  readonly host: string;
}

/** Same derivation as the market stream: proxy-relative in dev, direct origin when absolute. */
export function buildAlertStreamUrl(
  apiBase: string,
  locationLike: StreamLocation | undefined,
): string {
  if (apiBase.startsWith("/")) {
    const protocol = locationLike?.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${locationLike?.host ?? "localhost"}${apiBase.replace(/\/+$/, "")}${ALERT_STREAM_PATH}`;
  }

  const url = new URL(apiBase);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `${url.pathname.replace(/\/+$/, "")}${ALERT_STREAM_PATH}`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

function presentNotice(notice: AlertNotice): void {
  const options = { description: notice.ruleName };
  if (notice.severity === "critical") {
    toast.error(notice.summary, options);
    return;
  }
  if (notice.severity === "warn") {
    toast.warning(notice.summary, options);
    return;
  }
  toast.info(notice.summary, options);
}

/**
 * One tab-lifetime socket: cookies authenticate it, notices surface as toasts,
 * and the chart never sees a per-frame state update. `connected` only flips on
 * open/close so a consumer can show a status dot without re-rendering per notice.
 */
export function useAlertStream(): { connected: boolean } {
  const [connected, setConnected] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let disposed = false;
    const ledger = createNoticeLedger();

    function scheduleReconnect(): void {
      if (disposed || reconnectTimer !== null) return;

      const delay = Math.min(RECONNECT_BASE_DELAY_MS * 2 ** attempt, RECONNECT_MAX_DELAY_MS);
      attempt += 1;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        if (!disposed) connect();
      }, delay);
    }

    function connect(): void {
      const next = new WebSocket(buildAlertStreamUrl(API_BASE, globalThis.location));
      socket = next;

      next.addEventListener("open", () => {
        if (disposed || socket !== next) return;
        attempt = 0;
        setConnected(true);
      });

      next.addEventListener("message", (event) => {
        if (disposed || socket !== next) return;
        const frame = decodeAlertFrame(event.data);
        if (frame.kind !== "notice" || !ledger.accept(frame.notice)) return;
        presentNotice(frame.notice);
        void queryClient.invalidateQueries({ queryKey: queryKeys.alerts.deliveries() });
      });

      next.addEventListener("close", (event) => {
        if (socket !== next) return;
        socket = null;
        setConnected(false);
        if (disposed || event.code === UNAUTHORIZED_CLOSE_CODE) return;
        scheduleReconnect();
      });

      next.addEventListener("error", () => {
        if (disposed || socket !== next) return;
        setConnected(false);
      });
    }

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      const active = socket;
      socket = null;
      active?.close();
    };
  }, [queryClient]);

  return { connected };
}
