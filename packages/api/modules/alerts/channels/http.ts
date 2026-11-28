import { Clock, Effect, Match, Option, Redacted } from "effect";
import { asRecord, stringAt } from "../../../shared/parsing";
import { asHttpError, type HttpError } from "../../../platform/http/error-response";
import type { AlertsConfigService } from "../config";
import type { AlertsError } from "../errors";
import type { AlertsIdentityPort } from "../subject";
import { formatNotice } from "./format";
import type { ChannelsServicePort, ChannelRow } from "./service";
import { sendTelegram } from "./telegram";

type ChannelName = ChannelRow["channel"];
type OutboundMessage = Parameters<typeof sendTelegram>[3];
type SendResult = Awaited<ReturnType<typeof sendTelegram>>;
type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const ALERTS_PATH = "/api/alerts";
const CHANNELS_PATH = `${ALERTS_PATH}/channels`;
const CHANNELS_PREFIX = `${CHANNELS_PATH}/`;
const TEST_SUFFIX = "/test";
const CODE_PATTERN = /^[A-HJ-NP-Z2-9]{8}$/i;
const ATTEMPT_LIMIT = 10;
const ATTEMPT_WINDOW_MS = 60 * 1000;
const CONNECTED_MESSAGE = "Connected. You'll get alerts here.";
const EXPIRED_MESSAGE = "Code expired, request a new one.";

type JsonWriter = (body: unknown, status?: number, headers?: Record<string, string>) => Response;

interface Transport {
  readonly fetchImpl: FetchLike;
  readonly sendTelegram: typeof sendTelegram;
}

interface ChannelsRouteContext {
  readonly channels: ChannelsServicePort | undefined;
  readonly config: AlertsConfigService | undefined;
  readonly identity: AlertsIdentityPort | undefined;
}

interface ChannelsRoute {
  readonly method: string;
  readonly path: string;
  readonly handler: (
    request: Request,
    url: URL,
    context: ChannelsRouteContext,
  ) => Effect.Effect<Response, HttpError>;
}

interface Deps {
  readonly json: JsonWriter;
  readonly transport: Transport;
  readonly allowAttempt: (key: string, now: number) => boolean;
}

interface CodeAttempt {
  readonly attempted: boolean;
  readonly code: string | null;
}

const UNATTEMPTED: CodeAttempt = { attempted: false, code: null };

const mapAlertsError = (error: AlertsError): HttpError =>
  Match.value(error).pipe(
    Match.tag("NotFound", (missing) =>
      asHttpError(404, `Channel ${missing.id} not found`, "NOT_FOUND"),
    ),
    Match.tag("LimitExceeded", (exceeded) =>
      asHttpError(429, `Channel limit of ${exceeded.limit} reached`, "LIMIT_EXCEEDED"),
    ),
    Match.tag("InvalidRule", (invalid) => asHttpError(400, invalid.message, "INVALID_RULE")),
    Match.tag("Db", (db) => asHttpError(500, db.message, "INTERNAL_ERROR")),
    Match.exhaustive,
  );

const optionString = (value: Option.Option<string> | undefined): string | null => {
  if (value === undefined) return null;
  const raw = Option.getOrNull(value);
  return raw === null || raw.trim() === "" ? null : raw;
};

const optionRedacted = (value: Option.Option<Redacted.Redacted> | undefined): string | null => {
  if (value === undefined) return null;
  const secret = Option.getOrNull(value);
  if (secret === null) return null;
  const raw = Redacted.value(secret);
  return raw === "" ? null : raw;
};

const telegramConfigured = (config: AlertsConfigService | undefined): boolean =>
  optionString(config?.telegramBotUsername) !== null;

const manageUrlFor = (config: AlertsConfigService | undefined): string | undefined => {
  const base = optionString(config?.publicAppUrl);
  return base === null ? undefined : `${base.replace(/\/+$/, "")}/alerts`;
};

const makeAttemptLimiter = (): ((key: string, now: number) => boolean) => {
  const attempts = new Map<string, number[]>();

  return (key, now) => {
    const recent = (attempts.get(key) ?? []).filter((at) => now - at < ATTEMPT_WINDOW_MS);
    if (recent.length >= ATTEMPT_LIMIT) {
      attempts.set(key, recent);
      return false;
    }

    recent.push(now);
    attempts.set(key, recent);
    return true;
  };
};

const readJsonBody = (request: Request): Effect.Effect<unknown, HttpError> =>
  Effect.tryPromise({
    try: async () => (await request.json()) as unknown,
    catch: () => asHttpError(400, "Invalid JSON body", "INVALID_JSON"),
  });

const messageOf = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);

const readJsonSafely = (request: Request): Effect.Effect<unknown> =>
  Effect.tryPromise({
    try: async () => (await request.json()) as unknown,
    catch: () => null,
  }).pipe(Effect.catch(() => Effect.succeed(null)));

const channelNameFrom = (body: unknown): ChannelName | null => {
  const record = asRecord(body);
  if (record === null) return null;
  const raw = record["channel"];
  return raw === "telegram" ? raw : null;
};

const channelIdFrom = (url: URL): string => url.pathname.slice(CHANNELS_PREFIX.length);

const testChannelIdFrom = (url: URL): string => {
  const tail = channelIdFrom(url);
  return tail.endsWith(TEST_SUFFIX) ? tail.slice(0, -TEST_SUFFIX.length) : tail;
};

const parseTelegramCode = (text: string | undefined): CodeAttempt => {
  if (text === undefined) return UNATTEMPTED;
  const match = /^\/start(?:@\w+)?(?:\s+(.*))?$/i.exec(text.trim());
  if (match === null) return UNATTEMPTED;

  const candidate = (match[1] ?? "").trim();
  return { attempted: true, code: CODE_PATTERN.test(candidate) ? candidate.toUpperCase() : null };
};

const telegramLabel = (message: Record<string, unknown>): string | null => {
  const from = asRecord(message["from"]);
  if (from === null) return null;

  const username = stringAt(from, "username");
  if (username !== undefined && username.trim() !== "") return `@${username.trim()}`;
  return stringAt(from, "first_name") ?? null;
};

const sendTelegramText = (
  deps: Deps,
  config: AlertsConfigService | undefined,
  chatId: string,
  text: string,
): Effect.Effect<void> => {
  const token = optionRedacted(config?.telegramBotToken);
  if (token === null) return Effect.void;

  return Effect.tryPromise({
    try: () =>
      deps.transport.sendTelegram(deps.transport.fetchImpl, token, chatId, {
        title: "0xsignal alerts",
        body: text,
      }),
    catch: () => null,
  }).pipe(
    Effect.catch(() => Effect.void),
    Effect.asVoid,
  );
};

const senderFor = (
  deps: Deps,
  config: AlertsConfigService | undefined,
  row: ChannelRow,
  message: OutboundMessage,
): (() => Promise<SendResult>) | null => {
  if (row.channel !== "telegram") return null;
  const token = optionRedacted(config?.telegramBotToken);
  if (token === null) return null;
  return () =>
    deps.transport.sendTelegram(deps.transport.fetchImpl, token, row.destination, message);
};

const sendOnce = (
  deps: Deps,
  config: AlertsConfigService | undefined,
  row: ChannelRow,
  message: OutboundMessage,
): Effect.Effect<SendResult> => {
  const sender = senderFor(deps, config, row, message);
  if (sender === null) {
    return Effect.succeed({
      ok: false,
      error: `${row.channel} is not configured`,
      retryable: false,
    });
  }

  return Effect.tryPromise({
    try: sender,
    catch: (cause) => messageOf(cause),
  }).pipe(
    Effect.catch((reason) =>
      Effect.succeed<SendResult>({ ok: false, error: reason, retryable: false }),
    ),
  );
};

const resolveSubject = (request: Request, context: ChannelsRouteContext) =>
  Effect.gen(function* () {
    if (context.identity === undefined) {
      return yield* Effect.fail(
        asHttpError(503, "Alerts identity unavailable", "SERVICE_UNAVAILABLE"),
      );
    }

    const resolved = yield* context.identity
      .resolve(request, { mintDevice: false })
      .pipe(Effect.mapError(mapAlertsError));
    if (resolved.subject === null) {
      return yield* Effect.fail(
        asHttpError(401, "Alert subject could not be resolved", "UNAUTHORIZED"),
      );
    }
    return resolved.subject;
  });

const requireChannels = (
  context: ChannelsRouteContext,
): Effect.Effect<ChannelsServicePort, HttpError> =>
  context.channels === undefined
    ? Effect.fail(asHttpError(503, "Channels service unavailable", "SERVICE_UNAVAILABLE"))
    : Effect.succeed(context.channels);

const listChannels = (
  request: Request,
  context: ChannelsRouteContext,
  deps: Deps,
): Effect.Effect<Response, HttpError> =>
  Effect.gen(function* () {
    const channels = yield* requireChannels(context);
    const subject = yield* resolveSubject(request, context);
    const rows = yield* channels.list(subject).pipe(Effect.mapError(mapAlertsError));

    return deps.json({
      channels: rows,
      available: {
        telegram: telegramConfigured(context.config),
      },
    });
  });

const createLink = (
  request: Request,
  context: ChannelsRouteContext,
  deps: Deps,
): Effect.Effect<Response, HttpError> =>
  Effect.gen(function* () {
    const body = yield* readJsonBody(request);
    const channel = channelNameFrom(body);
    if (channel === null) {
      return yield* Effect.fail(
        asHttpError(400, "Expected channel to be `telegram`", "INVALID_CHANNEL"),
      );
    }

    const channels = yield* requireChannels(context);
    const subject = yield* resolveSubject(request, context);
    const now = yield* Clock.currentTimeMillis;
    const result = yield* channels
      .createLink(subject, channel, now)
      .pipe(Effect.mapError(mapAlertsError));

    return deps.json(result);
  });

const deleteChannel = (
  request: Request,
  url: URL,
  context: ChannelsRouteContext,
): Effect.Effect<Response, HttpError> =>
  Effect.gen(function* () {
    const channels = yield* requireChannels(context);
    const subject = yield* resolveSubject(request, context);
    const now = yield* Clock.currentTimeMillis;
    const id = channelIdFrom(url);

    yield* channels.unlink(subject, id, now).pipe(Effect.mapError(mapAlertsError));
    return new Response(null, { status: 204 });
  });

const testChannel = (
  request: Request,
  url: URL,
  context: ChannelsRouteContext,
  deps: Deps,
): Effect.Effect<Response, HttpError> =>
  Effect.gen(function* () {
    const channels = yield* requireChannels(context);
    const subject = yield* resolveSubject(request, context);
    const id = testChannelIdFrom(url);

    const rows = yield* channels.list(subject).pipe(Effect.mapError(mapAlertsError));
    const row = rows.find((candidate) => candidate.id === id);
    if (row === undefined) {
      return yield* Effect.fail(asHttpError(404, `Channel ${id} not found`, "NOT_FOUND"));
    }

    const now = yield* Clock.currentTimeMillis;
    const message = formatNotice(
      { ruleName: "Channel test", severity: "info", summary: "(test)", firedAt: now },
      manageUrlFor(context.config),
    );
    const result = yield* sendOnce(deps, context.config, row, message);

    if (result.ok) {
      yield* channels.markSent(row.id).pipe(Effect.catch(() => Effect.void));
      return deps.json({ ok: true });
    }

    yield* channels.markError(row.id, result.error).pipe(Effect.catch(() => Effect.void));
    return deps.json({ ok: false, error: result.error }, 502);
  });

type TelegramAuth = "authorized" | "unsecured" | "rejected";

const telegramAuthorized = (
  request: Request,
  config: AlertsConfigService | undefined,
): TelegramAuth => {
  const secret = optionRedacted(config?.telegramWebhookSecret);
  const header = request.headers.get("x-telegram-bot-api-secret-token");

  if (secret === null) return header === null ? "unsecured" : "rejected";
  return header !== null && header === secret ? "authorized" : "rejected";
};

const telegramWebhook = (
  request: Request,
  context: ChannelsRouteContext,
  deps: Deps,
): Effect.Effect<Response, AlertsError | HttpError> =>
  Effect.gen(function* () {
    const channels = context.channels;
    if (channels === undefined) return deps.json({ ok: true });

    const body = yield* readJsonSafely(request);
    const message = asRecord(asRecord(body)?.["message"]);
    if (message === null) return deps.json({ ok: true });

    const chat = asRecord(message["chat"]);
    const chatId = chat === null ? undefined : chat["id"];
    const destination =
      typeof chatId === "number" ? String(chatId) : typeof chatId === "string" ? chatId : null;
    if (destination === null) return deps.json({ ok: true });

    const attempt = parseTelegramCode(stringAt(message, "text"));
    if (!attempt.attempted) return deps.json({ ok: true });

    const now = yield* Clock.currentTimeMillis;
    if (!deps.allowAttempt(`telegram:${destination}`, now)) return deps.json({ ok: true });

    const consumed = attempt.code === null ? null : yield* channels.consumeLink(attempt.code, now);
    if (consumed === null || consumed.channel !== "telegram") {
      yield* sendTelegramText(deps, context.config, destination, EXPIRED_MESSAGE);
      return deps.json({ ok: true });
    }

    yield* channels.bindChannel(
      consumed.subject,
      "telegram",
      destination,
      telegramLabel(message),
      now,
    );
    yield* sendTelegramText(deps, context.config, destination, CONNECTED_MESSAGE);
    return deps.json({ ok: true });
  });

export const buildChannelsRoutes = (params: {
  readonly json: JsonWriter;
  readonly transport?: Partial<Transport>;
}): ChannelsRoute[] => {
  const transport: Transport = {
    fetchImpl: params.transport?.fetchImpl ?? ((input, init) => fetch(input, init)),
    sendTelegram: params.transport?.sendTelegram ?? sendTelegram,
  };
  const deps: Deps = {
    json: params.json,
    transport,
    allowAttempt: makeAttemptLimiter(),
  };

  let loggedUnsecured = false;

  const guardWebhook = <E>(effect: Effect.Effect<Response, E>): Effect.Effect<Response> =>
    effect.pipe(
      Effect.catchCause(() =>
        Effect.logWarning("[alerts] webhook handler failed").pipe(
          Effect.as(deps.json({ ok: true })),
        ),
      ),
    );

  return [
    {
      method: "GET",
      path: CHANNELS_PATH,
      handler: (request, _url, context) => listChannels(request, context, deps),
    },
    {
      method: "POST",
      path: `${CHANNELS_PATH}/link`,
      handler: (request, _url, context) => createLink(request, context, deps),
    },
    {
      method: "DELETE",
      path: `${CHANNELS_PATH}/:id`,
      handler: (request, url, context) => deleteChannel(request, url, context),
    },
    {
      method: "POST",
      path: `${CHANNELS_PATH}/:id${TEST_SUFFIX}`,
      handler: (request, url, context) => testChannel(request, url, context, deps),
    },
    {
      method: "POST",
      path: `${ALERTS_PATH}/webhooks/telegram`,
      handler: (request, _url, context) => {
        const auth = telegramAuthorized(request, context.config);
        if (auth === "rejected") return Effect.succeed(deps.json({ error: "Unauthorized" }, 401));

        const run = guardWebhook(telegramWebhook(request, context, deps));
        if (auth === "authorized" || loggedUnsecured) return run;

        loggedUnsecured = true;
        return Effect.logWarning(
          "[alerts] telegram webhook accepted without ALERTS_TELEGRAM_WEBHOOK_SECRET",
        ).pipe(Effect.flatMap(() => run));
      },
    },
  ];
};
