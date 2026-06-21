import type { ChartDataPoint, WsMarketChannel } from "@0xsignal/shared";
import { normalizeCandle } from "@0xsignal/shared";

// ── Wire Contract Types (source of truth — from backend) ───────────

/** Single orderbook level as received over the wire. */
export interface RawL2Level {
  readonly px: string;
  readonly sz: string;
  readonly n: number;
}

/**
 * L2 book snapshot — first message after subscribe.
 * Shape: { type: "snapshot", levels: [[bids], [asks]] }
 */
export interface L2BookSnapshotPayload {
  type: "snapshot";
  levels: readonly [readonly RawL2Level[], readonly RawL2Level[]];
}

/**
 * L2 book delta — subsequent messages after snapshot.
 * Shape: { type: "delta", delta: { changedBids, changedAsks, replace } }
 */
export interface L2BookDeltaPayload {
  type: "delta";
  delta: {
    changedBids: readonly RawL2Level[];
    changedAsks: readonly RawL2Level[];
    /** When true, frontend must re-fetch full REST snapshot. */
    replace: boolean;
  };
}

/** Decoded L2 book payload — preserves consumer contract shape. */
export type L2BookPayload = L2BookSnapshotPayload | L2BookDeltaPayload;

/** Meta fields that may accompany market stream messages. */
export interface MarketStreamMeta {
  nSigFigs?: number;
  interval?: string;
  coin?: string;
}

// ── Internal helpers ────────────────────────────────────────────────

type DecodedMessage =
  | { kind: "ignore" }
  | { kind: "control"; type: "ready" | "pong" | "reconnecting" | "error"; message?: string }
  | { kind: "market"; channel: WsMarketChannel; payload: unknown; meta?: MarketStreamMeta };

const CHANNELS: readonly WsMarketChannel[] = ["candle", "l2Book", "trades", "allMids"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isMarketChannel = (s: string): s is WsMarketChannel =>
  (CHANNELS as readonly string[]).includes(s);

const parseIncomingMessage = (raw: unknown): unknown => {
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
};

const asEnvelope = (value: unknown): Record<string, unknown> | null =>
  isRecord(value) ? value : null;

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

const findChannel = (value: unknown): WsMarketChannel | null => {
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

const extractCandlePayload = (value: unknown): unknown[] | null => {
  if (!isRecord(value)) {
    if (Array.isArray(value)) return value as unknown[];
    return null;
  }
  if (Array.isArray(value.data)) return value.data as unknown[];
  if (Array.isArray(value.candles)) return value.candles as unknown[];
  if (Array.isArray(value.candle)) return value.candle as unknown[];
  if (hasCandleShape(value)) return [value];
  if (isRecord(value.data) && hasCandleShape(value.data)) return [value.data];
  if (isRecord(value.candle) && hasCandleShape(value.candle)) return [value.candle];
  return null;
};

/**
 * Extract L2 book payload from the WS wire contract.
 *
 * The backend sends levels directly in the `data` envelope:
 *   { levels: [[bids], [asks]] }
 *
 * Future backend versions may add typed wrappers:
 *   snapshot: { snapshot: { levels: [[bids], [asks]] } }
 *   delta:   { delta: { changedBids, changedAsks, replace } }
 */
const extractOrderbookPayload = (
  dataField: unknown,
  envelopeNSigFigs?: number,
): { payload: L2BookPayload; nSigFigs?: number } | null => {
  if (!isRecord(dataField)) return null;

  // ── Direct levels format (what the backend actually sends) ─────
  // The backend broadcasts every L2 event as a full snapshot via:
  //   { type: "market", channel: "l2Book", data: { levels: [[bids], [asks]] } }
  // This check must come FIRST since there are no typed wrapper keys.
  if (
    Array.isArray(dataField.levels) &&
    dataField.levels.length === 2 &&
    Array.isArray(dataField.levels[0]) &&
    Array.isArray(dataField.levels[1])
  ) {
    return {
      payload: {
        type: "snapshot",
        levels: dataField.levels as unknown as readonly [
          readonly RawL2Level[],
          readonly RawL2Level[],
        ],
      },
      nSigFigs:
        typeof dataField.nSigFigs === "number" && Number.isFinite(dataField.nSigFigs)
          ? dataField.nSigFigs
          : envelopeNSigFigs,
    };
  }

  // ── Typed snapshot path (future backend format) ───────────────
  const snapshot = dataField.snapshot;
  if (isRecord(snapshot)) {
    const levels = snapshot.levels;
    if (
      Array.isArray(levels) &&
      levels.length === 2 &&
      Array.isArray(levels[0]) &&
      Array.isArray(levels[1])
    ) {
      return {
        payload: {
          type: "snapshot",
          levels: levels as unknown as readonly [readonly RawL2Level[], readonly RawL2Level[]],
        },
        nSigFigs:
          typeof dataField.nSigFigs === "number" && Number.isFinite(dataField.nSigFigs)
            ? dataField.nSigFigs
            : envelopeNSigFigs,
      };
    }
  }

  // ── Typed delta path (future backend format) ──────────────────
  const delta = dataField.delta;
  if (isRecord(delta)) {
    const changedBids = delta.changedBids;
    const changedAsks = delta.changedAsks;
    if (Array.isArray(changedBids) && Array.isArray(changedAsks)) {
      return {
        payload: {
          type: "delta",
          delta: {
            changedBids: changedBids as unknown as readonly RawL2Level[],
            changedAsks: changedAsks as unknown as readonly RawL2Level[],
            replace: delta.replace === true,
          },
        },
        nSigFigs:
          typeof dataField.nSigFigs === "number" && Number.isFinite(dataField.nSigFigs)
            ? dataField.nSigFigs
            : envelopeNSigFigs,
      };
    }
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

// ── Public API ──────────────────────────────────────────────────────

export function decodeMarketWsMessage(
  raw: unknown,
  expectedChannel: WsMarketChannel,
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
    return { kind: "market", channel, payload: candlePayload, meta };
  }

  if (channel === "l2Book") {
    const result = extractOrderbookPayload(
      isRecord(rootPayload) ? rootPayload : {},
      envelopeNSigFigs,
    );
    if (!result) return { kind: "ignore" };
    return {
      kind: "market",
      channel,
      payload: result.payload,
      meta: result.nSigFigs !== undefined ? { nSigFigs: result.nSigFigs } : undefined,
    };
  }

  // trades / allMids — passthrough
  return { kind: "market", channel, payload: rootPayload };
}

// ── Payload unwrappers (trades, tickers) ────────────────────────────

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
  // Single-pass: no intermediate filter/map arrays. Collect raw items first,
  // then push directly into result through normalizeCandle in one loop.
  let rawItems: unknown[];
  if (Array.isArray(value)) {
    rawItems = value;
  } else if (isRecord(value)) {
    if (Array.isArray(value.candles)) rawItems = value.candles;
    else if (Array.isArray(value.candle)) rawItems = value.candle;
    else if (Array.isArray(value.data)) rawItems = value.data;
    else rawItems = [value];
  } else {
    return [];
  }
  const result: ChartDataPoint[] = [];
  for (let i = 0; i < rawItems.length; i++) {
    const item = rawItems[i];
    if (isRecord(item)) {
      const candle = normalizeCandle(item);
      if (candle !== null) {
        result.push(candle);
      }
    }
  }
  return result;
};
