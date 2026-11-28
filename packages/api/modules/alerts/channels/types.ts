export type ChannelId = "inapp" | "telegram";

export type OutboundMessage = { title: string; body: string; manageUrl?: string };

export type SendResult = { ok: true } | { ok: false; error: string; retryable: boolean };

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
