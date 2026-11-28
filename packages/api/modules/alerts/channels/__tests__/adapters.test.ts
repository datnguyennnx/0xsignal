import { describe, expect, it } from "vitest";
import { formatNotice } from "../format";
import { sendTelegram, telegramDeepLink } from "../telegram";
import type { ChannelId, FetchLike, OutboundMessage, SendResult } from "../types";

const BOT = "0xsignal_alerts_bot";
const CODE = "abc 123/&";
const TOKEN = "secret-token";

const MESSAGE: OutboundMessage = {
  title: "warn: BTC alert",
  body: "BTC crossed 100\nAlert: BTC alert",
};

interface Call {
  readonly url: string;
  readonly init: RequestInit | undefined;
  readonly json: unknown;
}

const jsonReply = (
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
): Response =>
  new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json", ...init.headers },
  });

const stub = (reply: Response | Error): { fetchImpl: FetchLike; calls: Call[] } => {
  const calls: Call[] = [];
  const fetchImpl: FetchLike = async (input, init) => {
    const rawBody = init?.body;
    calls.push({
      url: input,
      init,
      json: typeof rawBody === "string" ? JSON.parse(rawBody) : undefined,
    });
    if (reply instanceof Error) throw reply;
    return reply;
  };

  return { fetchImpl, calls };
};

const expectFailure = (result: SendResult, retryable: boolean, errorPart: string): void => {
  expect(result.ok).toBe(false);
  if (result.ok) return;

  expect(result.retryable).toBe(retryable);
  expect(result.error).toContain(errorPart);
};

describe("sendTelegram", () => {
  it("posts plain text with the preview disabled", async () => {
    const { fetchImpl, calls } = stub(jsonReply({ ok: true, result: { message_id: 1 } }));

    const result = await sendTelegram(fetchImpl, TOKEN, "42", MESSAGE);

    expect(result).toEqual({ ok: true });
    expect(calls[0]?.url).toBe(`https://api.telegram.org/bot${TOKEN}/sendMessage`);
    expect(calls[0]?.json).toEqual({
      chat_id: "42",
      text: "warn: BTC alert\nBTC crossed 100\nAlert: BTC alert",
      disable_web_page_preview: true,
    });
  });

  it("surfaces retry_after on a 429 and keeps the token out of the error", async () => {
    const { fetchImpl } = stub(
      jsonReply(
        {
          ok: false,
          error_code: 429,
          description: "Too Many Requests",
          parameters: { retry_after: 30 },
        },
        { status: 429 },
      ),
    );

    const result = await sendTelegram(fetchImpl, TOKEN, "42", MESSAGE);

    expectFailure(result, true, "retry_after 30");
    expect(result.ok || result.error).not.toContain(TOKEN);
  });

  it("treats a blocked chat as permanent", async () => {
    const { fetchImpl } = stub(
      jsonReply(
        { ok: false, error_code: 403, description: "Forbidden: bot was blocked by the user" },
        { status: 403 },
      ),
    );

    const result = await sendTelegram(fetchImpl, TOKEN, "42", MESSAGE);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.retryable).toBe(false);
    expect(result.error).toContain("bot was blocked");
  });

  it("retries server and network failures", async () => {
    const server = stub(jsonReply({ ok: false }, { status: 502 }));
    const serverResult = await sendTelegram(server.fetchImpl, TOKEN, "42", MESSAGE);
    expect(serverResult.ok).toBe(false);
    if (serverResult.ok) return;
    expect(serverResult.retryable).toBe(true);
    expect(serverResult.error).toContain("502");

    const offline = stub(new Error("getaddrinfo ENOTFOUND api.telegram.org"));
    const offlineResult = await sendTelegram(offline.fetchImpl, TOKEN, "42", MESSAGE);
    expect(offlineResult.ok).toBe(false);
    if (offlineResult.ok) return;
    expect(offlineResult.retryable).toBe(true);
    expect(offlineResult.error).toContain("ENOTFOUND");
  });
});

describe("formatNotice", () => {
  it("lays out summary, rule and manage link as separate lines", () => {
    const msg = formatNotice(
      { ruleName: "BTC crosses 100", severity: "warn", summary: "BTC crossed 100", firedAt: 0 },
      "https://app.example/alerts/1",
    );

    expect(msg.title).toBe("warn: BTC crosses 100");
    expect(msg.body.split("\n")).toEqual([
      "BTC crossed 100",
      "Alert: BTC crosses 100",
      "Manage: https://app.example/alerts/1",
    ]);
  });

  it("truncates the title and the body at their caps", () => {
    const long = "x".repeat(2_000);
    const msg = formatNotice({ ruleName: long, severity: "warn", summary: long, firedAt: 0 });

    expect(msg.title).toHaveLength(80);
    expect(msg.title.endsWith("…")).toBe(true);
    expect(msg.body).toHaveLength(700);
    expect(msg.body.endsWith("…")).toBe(true);
  });
});

describe("deep links", () => {
  it("covers every external channel and encodes the code", () => {
    const builders: Record<ChannelId, ((code: string) => string) | undefined> = {
      inapp: undefined,
      telegram: (code) => telegramDeepLink(BOT, code),
    };

    expect(builders.inapp).toBeUndefined();
    expect(builders.telegram?.(CODE)).toBe(
      "https://t.me/0xsignal_alerts_bot?start=abc%20123%2F%26",
    );
  });
});
