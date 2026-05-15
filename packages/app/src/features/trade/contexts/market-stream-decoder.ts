/**
 * Decodes backend market-stream WS envelopes into typed payloads per channel.
 */
import type { ChartDataPoint } from "@0xsignal/shared";
import { normalizeCandle } from "@0xsignal/shared";

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
  if (typeof value !== "object" || value === null) return null;
  const obj = value as Record<string, unknown>;

  // Direct access: { channel: "candle", data: {...}, ... }
  if (typeof obj.channel === "string" && CHANNELS.includes(obj.channel as MarketChannel)) {
    return obj.channel as MarketChannel;
  }

  // { payload: { channel: "...", data: {...} } }
  if (typeof obj.payload === "object" && obj.payload !== null) {
    const payload = obj.payload as Record<string, unknown>;
    if (
      typeof payload.channel === "string" &&
      CHANNELS.includes(payload.channel as MarketChannel)
    ) {
      return payload.channel as MarketChannel;
    }
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
  if (typeof value !== "object" || value === null) return null;

  if (Array.isArray(value)) return value;

  const obj = value as Record<string, unknown>;

  if (Array.isArray(obj.data)) return obj.data;
  if (Array.isArray(obj.candles)) return obj.candles;
  if (Array.isArray(obj.candle)) return obj.candle;
  if (hasCandleShape(obj)) return value;

  // Single candle object nested in data/candle field
  if (
    obj.data &&
    typeof obj.data === "object" &&
    hasCandleShape(obj.data as Record<string, unknown>)
  ) {
    return obj.data;
  }
  if (
    obj.candle &&
    typeof obj.candle === "object" &&
    hasCandleShape(obj.candle as Record<string, unknown>)
  ) {
    return obj.candle;
  }

  return null;
};

const extractOrderbookPayload = (value: unknown): L2BookPayload | null => {
  if (typeof value !== "object" || value === null) return null;
  const obj = value as Record<string, unknown>;

  // Walk nested data/orderbook/levels path up to 4 levels deep
  const walkLevels = (node: Record<string, unknown>, depth: number): L2BookPayload | null => {
    if (depth > 4) return null;

    // Direct levels array found
    if (Array.isArray(node.levels)) {
      return { levels: node.levels };
    }
    if (Array.isArray(node.data)) return { levels: node.data };

    // Check known wrapper fields (levels is checked at top — skip to avoid redundant recursion)
    for (const key of ["data", "payload", "orderbook", "l2Book", "book", "result"] as const) {
      const child = node[key];
      if (typeof child === "object" && child !== null && !Array.isArray(child)) {
        const result = walkLevels(child as Record<string, unknown>, depth + 1);
        if (result) return result;
      }
    }

    return null;
  };

  const result = walkLevels(obj, 0);
  if (!result) return null;

  // Extract nSigFigs from the outermost level
  const nSigFigs =
    typeof obj.nSigFigs === "number" && Number.isFinite(obj.nSigFigs) ? obj.nSigFigs : undefined;
  return nSigFigs !== undefined ? { levels: result.levels, nSigFigs } : result;
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

/** Flatten WS candle payload shapes (array, {data}, {candles}, {candle}, single) into ChartDataPoint[]. */
export const convertToCandlePayload = (value: unknown): ChartDataPoint[] => {
  const rawItems: unknown[] = [];

  if (Array.isArray(value)) {
    rawItems.push(...value);
  } else if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (Array.isArray(obj.candles)) rawItems.push(...obj.candles);
    else if (Array.isArray(obj.candle)) rawItems.push(...obj.candle);
    else if (Array.isArray(obj.data)) rawItems.push(...obj.data);
    else rawItems.push(value); // treat as single candle object
  }

  return rawItems
    .map((item) => normalizeCandle(item as Record<string, unknown>))
    .filter((p): p is ChartDataPoint => p !== null);
};
