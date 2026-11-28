/** The slice of Bun's `Server` this handler needs, which keeps it testable. */
export type WsUpgradeServer<D> = {
  readonly upgrade: (req: Request, options: { readonly data: D }) => boolean;
};

/** A channel grammar's verdict on the query string, without any module type. */
type WsChannelParseResult<S> =
  | { readonly ok: true; readonly data: S }
  | { readonly ok: false; readonly status: number; readonly message: string };

export type WsUpgradeOptions<S, D> = {
  readonly path: string;
  readonly parseChannel: (params: URLSearchParams) => WsChannelParseResult<S> | undefined;
  readonly createConnectionData: (subscription: S | undefined) => D;
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
export const handleWsUpgrade = <S, D>(
  url: URL,
  req: Request,
  server: WsUpgradeServer<D>,
  options: WsUpgradeOptions<S, D>,
): Response | undefined => {
  if (url.pathname !== options.path) return undefined;

  const channel = (url.searchParams.get("channel") ?? url.searchParams.get("type") ?? "").trim();
  const parsed = channel === "" ? undefined : options.parseChannel(url.searchParams);
  if (parsed !== undefined && !parsed.ok) {
    return new Response(JSON.stringify({ error: parsed.message, status: parsed.status }), {
      status: parsed.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  const upgraded = server.upgrade(req, {
    data: options.createConnectionData(parsed === undefined ? undefined : parsed.data),
  });

  if (upgraded) return undefined;

  return new Response(JSON.stringify({ error: "WebSocket upgrade failed", status: 400 }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
};

/** Connection data the alerts upgrade attaches; the socket handlers read it back. */
export type AlertsWsConnectionData = {
  readonly kind: "alerts";
  readonly subjectKey: string;
};

export const ALERTS_WS_PATH = "/api/ws/alerts";

const alertError = (status: number, message: string): Response =>
  new Response(JSON.stringify({ error: message, status }), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/**
 * The alerts sibling of `handleWsUpgrade`. The subject is resolved before the
 * handshake, so a request without a usable identity is rejected with an HTTP
 * 401 and Bun never sees a socket. Returns `undefined` for other paths, which
 * lets a caller chain it with the market branch.
 */
export const upgradeAlertsWs = async (
  url: URL,
  req: Request,
  server: WsUpgradeServer<AlertsWsConnectionData>,
  resolveSubjectKey: (request: Request) => Promise<string | null>,
): Promise<Response | undefined> => {
  if (url.pathname !== ALERTS_WS_PATH) return undefined;

  let subjectKey: string | null;
  try {
    subjectKey = await resolveSubjectKey(req);
  } catch {
    subjectKey = null;
  }

  if (subjectKey === null || subjectKey === "") {
    return alertError(401, "Unauthorized");
  }

  if (!server.upgrade(req, { data: { kind: "alerts", subjectKey } })) {
    return alertError(400, "WebSocket upgrade failed");
  }

  return undefined;
};
