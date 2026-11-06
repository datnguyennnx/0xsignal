import type { ChartDataPoint, WsMarketChannel } from "@0xsignal/shared";
import { normalizeCandle } from "@0xsignal/shared";

// ── Wire Contract Types (source of truth — from backend) ───────────

/** Single orderbook level as received over the wire. */
interface RawL2Level {
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

/** Meta fields that may accompany market stream messages. */
export interface MarketStreamMeta {
  nSigFigs?: number;
  interval?: string;
  coin?: string;
}

// ── Internal helpers ────────────────────────────────────────────────

type DecodedMessage =
  | { kind: "ignore" }
  | {
      kind: "control";
      type: "ready" | "pong" | "reconnecting" | "error";
      message?: string | undefined;
    }
  | {
      kind: "market";
      channel: WsMarketChannel;
      payload: unknown;
      meta?: MarketStreamMeta | undefined;
    };

const CHANNELS: readonly WsMarketChannel[] = ["candle", "l2Book", "allMids"];

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
  if (
    isRecord(value.payload) &&
    typeof value.payload.channel === "string" &&
    isMarketChannel(value.payload.channel)
  ) {
    return value.payload.channel;
  }
  return null;
};

// The wire contract is trusted for level shape; only the container is validated.
const isLevelArray = (value: unknown): value is readonly RawL2Level[] => Array.isArray(value);

const isUnknownArray = (value: unknown): value is unknown[] => Array.isArray(value);

const isLevelsPair = (
  value: unknown,
): value is readonly [readonly RawL2Level[], readonly RawL2Level[]] =>
  Array.isArray(value) && value.length === 2 && isLevelArray(value[0]) && isLevelArray(value[1]);

export const isL2BookSnapshotPayload = (value: unknown): value is L2BookSnapshotPayload =>
  isRecord(value) && value.type === "snapshot" && isLevelsPair(value.levels);

interface CandleWire extends Record<string, unknown> {
  t: unknown;
  o: unknown;
  c: unknown;
  h: unknown;
  l: unknown;
  v: unknown;
}

const hasCandleShape = (value: unknown): value is CandleWire =>
  isRecord(value) &&
  "t" in value &&
  "o" in value &&
  "c" in value &&
  "h" in value &&
  "l" in value &&
  "v" in value;

const extractCandlePayload = (value: unknown): unknown[] | null => {
  if (isUnknownArray(value)) return value;
  if (hasCandleShape(value)) return [value];
  return null;
};

/**
 * Extract L2 book payload from the WS wire contract.
 *
 * The hub emits the merged book as `data.snapshot.levels`; the direct/legacy
 * shape puts `levels` straight on `data`.
 */
const extractOrderbookPayload = (
  dataField: unknown,
  envelopeNSigFigs?: number,
): { payload: L2BookSnapshotPayload; nSigFigs?: number | undefined } | null => {
  if (!isRecord(dataField)) return null;

  // The hub wraps the merged book as `data.snapshot.levels`; older/legacy
  // producers put `levels` directly on `data`.
  const levelsSource = isRecord(dataField.snapshot) ? dataField.snapshot : dataField;
  if (!isLevelsPair(levelsSource.levels)) return null;

  const rawNSigFigs = dataField.nSigFigs ?? levelsSource.nSigFigs;
  return {
    payload: {
      type: "snapshot",
      levels: levelsSource.levels,
    },
    nSigFigs:
      typeof rawNSigFigs === "number" && Number.isFinite(rawNSigFigs)
        ? rawNSigFigs
        : envelopeNSigFigs,
  };
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
  if (rootType !== null && rootType !== "" && rootType !== "market") {
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
      meta: result.nSigFigs === undefined ? undefined : { nSigFigs: result.nSigFigs },
    };
  }

  // allMids — passthrough
  return { kind: "market", channel, payload: rootPayload };
}

// ── Payload unwrapper (tickers) ─────────────────────────────────────

const unwrapTickerPayload = (value: unknown): unknown => {
  if (!isRecord(value)) return value;
  return value.ticker ?? value.allMids ?? value.mids ?? value;
};

export { unwrapTickerPayload };

export const convertToCandlePayload = (value: unknown): ChartDataPoint[] => {
  const items = Array.isArray(value) ? value : isRecord(value) ? [value] : [];
  const result: ChartDataPoint[] = [];
  for (const item of items) {
    if (!isRecord(item)) continue;
    const candle = normalizeCandle(item);
    if (candle !== null) result.push(candle);
  }
  return result;
};
