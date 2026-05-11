/**
 * @overview Market Stream Decoder
 *
 * Decodes backend market-stream WS envelopes into channel-specific payloads for
 * frontend rendering hooks. This is transport-local adaptation logic, not a
 * canonical market-data authority.
 */
import { toFiniteNumber } from "@/core/utils/hyperliquid";

type MarketChannel = "candle" | "l2Book" | "trades" | "allMids";

interface L2BookPayload {
  levels: unknown;
  nSigFigs?: number;
}

interface MarketEnvelope {
  type?: unknown;
  channel?: unknown;
  data?: unknown;
  payload?: unknown;
  message?: unknown;
  nSigFigs?: unknown;
  interval?: unknown;
  coin?: unknown;
}

export interface MarketStreamMeta {
  nSigFigs?: number;
  interval?: string;
  coin?: string;
}

type DecodedMessage =
  | { kind: "ignore" }
  | { kind: "control"; type: "ready" | "pong" | "reconnecting" | "error"; message?: string }
  | { kind: "market"; channel: MarketChannel; payload: unknown; meta?: MarketStreamMeta };

const CHANNELS: MarketChannel[] = ["candle", "l2Book", "trades", "allMids"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const parseIncomingMessage = (raw: unknown): unknown => {
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
};

const asEnvelope = (value: unknown): MarketEnvelope | null => {
  if (!isRecord(value)) return null;
  return value as MarketEnvelope;
};

const getControlType = (value: unknown): "ready" | "pong" | "reconnecting" | "error" | null => {
  const envelope = asEnvelope(value);
  if (!envelope || typeof envelope.type !== "string") return null;
  if (
    envelope.type === "ready" ||
    envelope.type === "pong" ||
    envelope.type === "reconnecting" ||
    envelope.type === "error"
  ) {
    return envelope.type;
  }
  return null;
};

const findChannel = (value: unknown): MarketChannel | null => {
  const queue: unknown[] = [value];
  const seen = new Set<unknown>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || seen.has(current)) continue;
    seen.add(current);

    if (!isRecord(current)) continue;

    if (
      typeof current.channel === "string" &&
      CHANNELS.includes(current.channel as MarketChannel)
    ) {
      return current.channel as MarketChannel;
    }

    if (current.data !== undefined) queue.push(current.data);
    if (current.payload !== undefined) queue.push(current.payload);
  }

  return null;
};

const hasCandleShape = (value: Record<string, unknown>): boolean =>
  (typeof value.t === "number" || typeof value.t === "string") &&
  value.o !== undefined &&
  value.h !== undefined &&
  value.l !== undefined &&
  value.c !== undefined;

const extractCandlePayload = (value: unknown): unknown => {
  const queue: unknown[] = [value];
  const seen = new Set<unknown>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined || current === null || seen.has(current)) continue;
    seen.add(current);

    if (Array.isArray(current)) {
      return current;
    }

    if (!isRecord(current)) {
      continue;
    }

    if (Array.isArray(current.candles)) return current.candles;
    if (Array.isArray(current.candle)) return current.candle;
    if (hasCandleShape(current)) return current;

    if (current.data !== undefined) queue.push(current.data);
    if (current.payload !== undefined) queue.push(current.payload);
    if (current.candles !== undefined) queue.push(current.candles);
    if (current.candle !== undefined) queue.push(current.candle);
  }

  return null;
};

const extractOrderbookPayload = (value: unknown): L2BookPayload | null => {
  const queue: unknown[] = [value];
  const seen = new Set<unknown>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined || current === null || seen.has(current)) continue;
    seen.add(current);

    if (!isRecord(current)) continue;

    if (Array.isArray(current.levels)) {
      const nSigFigs =
        typeof current.nSigFigs === "number" && Number.isFinite(current.nSigFigs)
          ? current.nSigFigs
          : undefined;
      return { levels: current.levels, nSigFigs };
    }

    if (current.data !== undefined) queue.push(current.data);
    if (current.payload !== undefined) queue.push(current.payload);
    if (current.l2Book !== undefined) queue.push(current.l2Book);
    if (current.book !== undefined) queue.push(current.book);
    if (current.orderbook !== undefined) queue.push(current.orderbook);
  }

  return null;
};

const unwrapMarketPayload = (value: unknown): unknown => {
  const envelope = asEnvelope(value);
  if (!envelope) return value;
  if (envelope.data !== undefined) return envelope.data;
  if (envelope.payload !== undefined) return envelope.payload;
  return value;
};

export function decodeMarketWsMessage(
  raw: unknown,
  expectedChannel: MarketChannel
): DecodedMessage {
  const parsed = parseIncomingMessage(raw);
  const controlType = getControlType(parsed);

  if (controlType) {
    const envelope = asEnvelope(parsed);
    const message = typeof envelope?.message === "string" ? envelope.message : undefined;
    return { kind: "control", type: controlType, message };
  }

  const envelope = asEnvelope(parsed);
  const rootType = typeof envelope?.type === "string" ? envelope.type : null;
  if (rootType && rootType !== "market") {
    return { kind: "ignore" };
  }

  const channel = findChannel(parsed) ?? expectedChannel;
  if (channel !== expectedChannel) {
    return { kind: "ignore" };
  }

  const envelopeNSigFigs =
    typeof envelope?.nSigFigs === "number" && Number.isFinite(envelope.nSigFigs)
      ? envelope.nSigFigs
      : undefined;
  const envelopeInterval = typeof envelope?.interval === "string" ? envelope.interval : undefined;
  const envelopeCoin = typeof envelope?.coin === "string" ? envelope.coin : undefined;
  const rootPayload = unwrapMarketPayload(parsed);

  if (channel === "candle") {
    const candlePayload = extractCandlePayload(rootPayload);
    if (candlePayload === null) return { kind: "ignore" };
    const meta: MarketStreamMeta | undefined =
      envelopeInterval !== undefined || envelopeCoin !== undefined
        ? {
            ...(envelopeInterval !== undefined && { interval: envelopeInterval }),
            ...(envelopeCoin !== undefined && { coin: envelopeCoin }),
          }
        : undefined;
    return {
      kind: "market",
      channel,
      payload: candlePayload,
      meta,
    };
  }

  if (channel === "l2Book") {
    const orderbookPayload = extractOrderbookPayload({
      nSigFigs: envelopeNSigFigs,
      data: rootPayload,
    });
    if (!orderbookPayload) return { kind: "ignore" };
    const nSigFigs = orderbookPayload.nSigFigs ?? envelopeNSigFigs;
    return {
      kind: "market",
      channel,
      payload: { levels: orderbookPayload.levels },
      meta: nSigFigs !== undefined ? { nSigFigs } : undefined,
    };
  }

  return { kind: "market", channel, payload: rootPayload };
}

export type { MarketChannel };

const unwrapTradePayload = (value: unknown): unknown => {
  if (typeof value !== "object" || value === null) return value;
  const payload = value as Record<string, unknown>;
  return payload.tradeAnnotation ?? payload.annotation ?? payload;
};

const unwrapTickerPayload = (value: unknown): unknown => {
  if (typeof value !== "object" || value === null) return value;
  const payload = value as Record<string, unknown>;
  return payload.ticker ?? payload.allMids ?? payload.mids ?? payload;
};

export { unwrapTradePayload, unwrapTickerPayload };

export interface StreamCandlePayload {
  t: number;
  o: string;
  h: string;
  l: string;
  c: string;
  v: string;
}

const normalizeCandleEntry = (raw: Record<string, unknown>): StreamCandlePayload | null => {
  const time = raw.t ?? raw.time ?? raw.timestamp;
  const t =
    typeof time === "number" ? time : typeof time === "string" ? Date.parse(time) : Number.NaN;

  const o = toFiniteNumber(raw.o ?? raw.open);
  const h = toFiniteNumber(raw.h ?? raw.high);
  const l = toFiniteNumber(raw.l ?? raw.low);
  const c = toFiniteNumber(raw.c ?? raw.close);
  const v = toFiniteNumber(raw.v ?? raw.volume);

  if (!Number.isFinite(t) || o === null || h === null || l === null || c === null || v === null) {
    return null;
  }

  return {
    t,
    o: String(o),
    h: String(h),
    l: String(l),
    c: String(c),
    v: String(v),
  };
};

const normalizeCandlePayload = (value: unknown): StreamCandlePayload[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const mapped: StreamCandlePayload[] = [];

  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) continue;
    const normalized = normalizeCandleEntry(entry as Record<string, unknown>);
    if (normalized) mapped.push(normalized);
  }

  return mapped;
};

export const convertToCandlePayload = (value: unknown): StreamCandlePayload[] => {
  if (Array.isArray(value)) {
    return normalizeCandlePayload(value);
  }

  if (typeof value !== "object" || value === null) {
    return [];
  }

  const payload = value as Record<string, unknown>;

  if (Array.isArray(payload.candles)) {
    return normalizeCandlePayload(payload.candles);
  }

  if (Array.isArray(payload.candle)) {
    return normalizeCandlePayload(payload.candle);
  }

  const single = normalizeCandleEntry(payload);
  return single ? [single] : [];
};
