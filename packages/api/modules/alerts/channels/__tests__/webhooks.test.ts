import { describe, expect, it } from "vitest";
import { Effect, Option, Redacted } from "effect";
import { AlertsConfig, type AlertsConfigService } from "../../config";
import type { AlertsIdentityPort } from "../../subject";
import type { Subject } from "../../table";
import { buildChannelsRoutes } from "../http";
import type { ChannelsServicePort } from "../service";
import type { ChannelName, ChannelRow } from "../table";
import type { FetchLike, OutboundMessage, SendResult } from "../types";

const SECRET = "telegram-webhook-secret";
const CODE = "ABCDEFGH";
const SUBJECT: Subject = { type: "device", id: "device-1" };
const TELEGRAM_PATH = "/api/alerts/webhooks/telegram";

interface ConsumedLink {
  readonly subject: Subject;
  readonly channel: ChannelName;
}

interface BindCall {
  readonly subject: Subject;
  readonly channel: ChannelName;
  readonly destination: string;
  readonly label: string | null;
}

interface ChannelsStub {
  readonly port: ChannelsServicePort;
  readonly binds: BindCall[];
  readonly consumedCodes: string[];
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const channelRow = (channel: ChannelName, destination: string): ChannelRow => ({
  id: `channel-${channel}`,
  channel,
  destination,
  label: null,
  verifiedAt: null,
  lastError: null,
  lastSentAt: null,
});

const makeChannels = (
  options: {
    readonly consume?: (code: string) => ConsumedLink | null;
    readonly bindThrows?: boolean;
  } = {},
): ChannelsStub => {
  const binds: BindCall[] = [];
  const consumedCodes: string[] = [];

  const port: ChannelsServicePort = {
    list: () => Effect.succeed([]),
    createLink: () => Effect.die("createLink is not used by webhooks"),
    consumeLink: (code) => {
      consumedCodes.push(code);
      return Effect.succeed(options.consume?.(code) ?? null);
    },
    bindChannel: (subject, channel, destination, label) => {
      binds.push({ subject, channel, destination, label });
      return options.bindThrows === true
        ? Effect.die(new Error("bind failed"))
        : Effect.succeed(channelRow(channel, destination));
    },
    unlink: () => Effect.void,
    markSent: () => Effect.void,
    markError: () => Effect.void,
    forSubjects: () => Effect.succeed(new Map<string, ChannelRow[]>()),
  };

  return { port, binds, consumedCodes };
};

const makeConfig = (): AlertsConfigService =>
  AlertsConfig.of({
    pollIntervalMs: 2_000,
    maxRulesPerDevice: 10,
    dailyCap: 12,
    telegramBotToken: Option.some(Redacted.make("telegram-token")),
    telegramBotUsername: Option.some("signal_bot"),
    telegramWebhookSecret: Option.some(Redacted.make(SECRET)),
  });

const identity: AlertsIdentityPort = {
  resolve: () => Effect.die("identity resolution is not used by webhooks"),
};

interface TelegramCall {
  readonly token: string;
  readonly chatId: string;
  readonly message: OutboundMessage;
}

const makeTransport = () => {
  const telegram: TelegramCall[] = [];

  const transport = {
    fetchImpl: async (): Promise<Response> => {
      throw new Error("network disabled in tests");
    },
    sendTelegram: (
      _fetchImpl: FetchLike,
      token: string,
      chatId: string,
      message: OutboundMessage,
    ): Promise<SendResult> => {
      telegram.push({ token, chatId, message });
      return Promise.resolve({ ok: true });
    },
  };

  return { transport, telegram };
};

interface RouteContext {
  readonly channels: ChannelsServicePort | undefined;
  readonly config: AlertsConfigService | undefined;
  readonly identity: AlertsIdentityPort | undefined;
}

type RouteSet = ReturnType<typeof buildChannelsRoutes>;

const makeRoutes = (channels: ChannelsServicePort, config: AlertsConfigService = makeConfig()) => {
  const { transport, telegram } = makeTransport();
  const context: RouteContext = { channels, config, identity };
  return { routes: buildChannelsRoutes({ json, transport }), telegram, context };
};

const invoke = (
  routes: RouteSet,
  method: string,
  path: string,
  request: Request,
  context: RouteContext,
): Promise<Response> => {
  const route = routes.find((candidate) => candidate.method === method && candidate.path === path);
  if (route === undefined) throw new Error(`missing route ${method} ${path}`);
  return Effect.runPromise(route.handler(request, new URL(request.url), context));
};

const telegramRequest = (body: unknown, secret: string = SECRET): Request =>
  new Request(`http://localhost${TELEGRAM_PATH}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-telegram-bot-api-secret-token": secret,
    },
    body: JSON.stringify(body),
  });

const telegramStart = (chatId: number, text: string, username = "alice"): unknown => ({
  message: { chat: { id: chatId }, from: { username }, text },
});

describe("telegram webhook", () => {
  it("binds the chat from a valid secret and /start code", async () => {
    const channels = makeChannels({
      consume: () => ({ subject: SUBJECT, channel: "telegram" }),
    });
    const { routes, telegram, context } = makeRoutes(channels.port);

    const response = await invoke(
      routes,
      "POST",
      TELEGRAM_PATH,
      telegramRequest(telegramStart(42, `/start ${CODE}`)),
      context,
    );

    expect(response.status).toBe(200);
    expect(channels.consumedCodes).toEqual([CODE]);
    expect(channels.binds).toEqual([
      { subject: SUBJECT, channel: "telegram", destination: "42", label: "@alice" },
    ]);
    expect(telegram).toHaveLength(1);
    expect(telegram[0]?.chatId).toBe("42");
    expect(telegram[0]?.message.body).toContain("Connected");
  });

  it("binds only once when the same code is delivered twice", async () => {
    const seen = new Set<string>();
    const channels = makeChannels({
      consume: (code) => {
        if (seen.has(code)) return null;
        seen.add(code);
        return { subject: SUBJECT, channel: "telegram" };
      },
    });
    const { routes, telegram, context } = makeRoutes(channels.port);

    const first = await invoke(
      routes,
      "POST",
      TELEGRAM_PATH,
      telegramRequest(telegramStart(42, `/start ${CODE}`)),
      context,
    );
    const second = await invoke(
      routes,
      "POST",
      TELEGRAM_PATH,
      telegramRequest(telegramStart(42, `/start ${CODE}`)),
      context,
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(channels.binds).toHaveLength(1);
    expect(telegram).toHaveLength(2);
    expect(telegram[1]?.message.body).toContain("Code expired");
  });

  it("rejects a wrong secret without binding", async () => {
    const channels = makeChannels({
      consume: () => ({ subject: SUBJECT, channel: "telegram" }),
    });
    const { routes, telegram, context } = makeRoutes(channels.port);

    const response = await invoke(
      routes,
      "POST",
      TELEGRAM_PATH,
      telegramRequest(telegramStart(42, `/start ${CODE}`), "wrong-secret"),
      context,
    );

    expect(response.status).toBe(401);
    expect(channels.binds).toHaveLength(0);
    expect(channels.consumedCodes).toHaveLength(0);
    expect(telegram).toHaveLength(0);
  });

  it("replies to an expired or unknown code without failing", async () => {
    const channels = makeChannels({ consume: () => null });
    const { routes, telegram, context } = makeRoutes(channels.port);

    const response = await invoke(
      routes,
      "POST",
      TELEGRAM_PATH,
      telegramRequest(telegramStart(42, `/start ${CODE}`)),
      context,
    );

    expect(response.status).toBe(200);
    expect(channels.binds).toHaveLength(0);
    expect(telegram).toHaveLength(1);
    expect(telegram[0]?.message.body).toContain("Code expired");
  });
});

describe("webhook robustness", () => {
  it("returns 200 when bindChannel throws", async () => {
    const channels = makeChannels({
      consume: () => ({ subject: SUBJECT, channel: "telegram" }),
      bindThrows: true,
    });
    const { routes, context } = makeRoutes(channels.port);

    const response = await invoke(
      routes,
      "POST",
      TELEGRAM_PATH,
      telegramRequest(telegramStart(42, `/start ${CODE}`)),
      context,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(channels.binds).toHaveLength(1);
  });

  it("silently drops the eleventh attempt from one destination", async () => {
    const channels = makeChannels({
      consume: () => ({ subject: SUBJECT, channel: "telegram" }),
    });
    const { routes, telegram, context } = makeRoutes(channels.port);

    const statuses: number[] = [];
    for (let attempt = 0; attempt < 11; attempt += 1) {
      const response = await invoke(
        routes,
        "POST",
        TELEGRAM_PATH,
        telegramRequest(telegramStart(42, `/start ${CODE}`)),
        context,
      );
      statuses.push(response.status);
    }

    expect(statuses).toEqual(Array.from({ length: 11 }, () => 200));
    expect(channels.binds).toHaveLength(10);
    expect(channels.consumedCodes).toHaveLength(10);
    expect(telegram).toHaveLength(10);
  });
});
