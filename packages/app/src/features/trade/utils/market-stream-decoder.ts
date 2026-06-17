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

const isMarketChannel = (s: string): s is MarketChannel =>
  (CHANNELS as readonly string[]).includes(s);

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
  return value;
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
  if (!isRecord(value)) return null;

  if (typeof value.channel === "string" && isMarketChannel(value.channel)) {
    return value.channel;
  }

  if (isRecord(value.payload)) {
    if (typeof value.payload.channel === "string" && isMarketChannel(value.payload.channel)) {
      return value.payload.channel;
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
  if (!isRecord(value)) {
    if (Array.isArray(value)) return value;
    return null;
  }

  if (Array.isArray(value.data)) return value.data;
  if (Array.isArray(value.candles)) return value.candles;
  if (Array.isArray(value.candle)) return value.candle;
  if (hasCandleShape(value)) return value;

  if (isRecord(value.data) && hasCandleShape(value.data)) {
    return value.data;
  }
  if (isRecord(value.candle) && hasCandleShape(value.candle)) {
    return value.candle;
  }

  return null;
};

const extractOrderbookPayload = (value: unknown): L2BookPayload | null => {
  if (!isRecord(value)) return null;

  const walkLevels = (node: Record<string, unknown>, depth: number): L2BookPayload | null => {
    if (depth > 4) return null;

    if (Array.isArray(node.levels)) {
      return { levels: node.levels };
    }
    if (Array.isArray(node.data)) return { levels: node.data };

    for (const key of ["data", "payload", "orderbook", "l2Book", "book", "result"] as const) {
      const child = node[key];
      if (isRecord(child) && !Array.isArray(child)) {
        const result = walkLevels(child, depth + 1);
        if (result) return result;
      }
    }

    return null;
  };

  const result = walkLevels(value, 0);
  if (!result) return null;

  const nSigFigs =
    typeof value.nSigFigs === "number" && Number.isFinite(value.nSigFigs)
      ? value.nSigFigs
      : undefined;
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
  expectedChannel: MarketChannel,
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
  if (!isRecord(value)) return value;
  return value.tradeAnnotation ?? value.annotation ?? value;
};

const unwrapTickerPayload = (value: unknown): unknown => {
  if (!isRecord(value)) return value;
  return value.ticker ?? value.allMids ?? value.mids ?? value;
};

export { unwrapTradePayload, unwrapTickerPayload };

export const convertToCandlePayload = (value: unknown): ChartDataPoint[] => {
  const rawItems: unknown[] = [];

  if (Array.isArray(value)) {
    rawItems.push(...value);
  } else if (isRecord(value)) {
    if (Array.isArray(value.candles)) rawItems.push(...value.candles);
    else if (Array.isArray(value.candle)) rawItems.push(...value.candle);
    else if (Array.isArray(value.data)) rawItems.push(...value.data);
    else rawItems.push(value);
  }

  return rawItems
    .filter(isRecord)
    .map(normalizeCandle)
    .filter((p): p is ChartDataPoint => p !== null);
};
