import type { FetchLike, OutboundMessage, SendResult } from "./types";

const API_ROOT = "https://api.telegram.org";

interface TelegramReply {
  ok?: boolean;
  description?: string;
  parameters?: { retry_after?: number };
}

const isTelegramReply = (value: unknown): value is TelegramReply =>
  typeof value === "object" && value !== null;

const readReply = async (response: Response): Promise<TelegramReply> => {
  try {
    const body: unknown = await response.json();
    return isTelegramReply(body) ? body : {};
  } catch {
    return {};
  }
};

export const telegramDeepLink = (botUsername: string, code: string): string =>
  `https://t.me/${botUsername}?start=${encodeURIComponent(code)}`;

export const sendTelegram = async (
  fetchImpl: FetchLike,
  token: string,
  chatId: string,
  msg: OutboundMessage,
): Promise<SendResult> => {
  const text = `${msg.title}\n${msg.body}`;

  try {
    const response = await fetchImpl(`${API_ROOT}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    });
    const reply = await readReply(response);

    if (response.ok && reply.ok === true) return { ok: true };

    if (response.status === 429) {
      const retryAfter = reply.parameters?.retry_after;
      return {
        ok: false,
        error:
          retryAfter === undefined
            ? "telegram rate limited"
            : `telegram rate limited (retry_after ${retryAfter})`,
        retryable: true,
      };
    }

    if (response.status >= 500) {
      return { ok: false, error: `telegram server error ${response.status}`, retryable: true };
    }

    return {
      ok: false,
      error: reply.description ?? `telegram rejected the message (status ${response.status})`,
      retryable: false,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "request failed";
    return { ok: false, error: reason.split(token).join("[redacted]"), retryable: true };
  }
};
