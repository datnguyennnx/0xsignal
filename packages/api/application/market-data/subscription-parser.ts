import { Result, Schema } from "effect";
import { WS_MARKET_INTERVALS, normalizeSymbol } from "@0xsignal/shared";
import type { MarketWsSubscription } from "./market-stream.contracts";

export type ParseResult =
  | { readonly ok: true; readonly data: MarketWsSubscription }
  | { readonly ok: false; readonly status: number; readonly message: string };

const IntervalSchema = Schema.Literals(WS_MARKET_INTERVALS);
const NSigFigsSchema = Schema.NullOr(Schema.Literals([2, 3, 4, 5]));

const AllMidsSchema = Schema.Struct({
  channel: Schema.Literal("allMids"),
  symbol: Schema.optional(Schema.String),
  dex: Schema.optional(Schema.String),
});

const CandleSchema = Schema.Struct({
  channel: Schema.Literal("candle"),
  symbol: Schema.NonEmptyString,
  interval: IntervalSchema,
});

const L2BookSchema = Schema.Struct({
  channel: Schema.Literal("l2Book"),
  symbol: Schema.NonEmptyString,
  nSigFigs: Schema.optional(NSigFigsSchema),
  fast: Schema.optional(Schema.Boolean),
  depth: Schema.optional(Schema.Number),
});

const TradesSchema = Schema.Struct({
  channel: Schema.Literal("trades"),
  symbol: Schema.NonEmptyString,
});

// Schema.Union picks the variant by the `channel` discriminator; fields that
// belong to other variants are ignored rather than rejected.
const SubscriptionSchema = Schema.Union([AllMidsSchema, CandleSchema, L2BookSchema, TradesSchema]);

export const parseMarketWsSubscription = (params: URLSearchParams): ParseResult => {
  const channel = (params.get("channel") ?? params.get("type") ?? "").trim();
  const symbol = params.get("symbol") ?? params.get("coin") ?? "";
  const interval = (params.get("interval") ?? "1m").trim();
  const nSigFigsStr = params.get("nSigFigs") ?? params.get("depth");
  const dex = params.get("dex")?.trim();
  const fastStr = params.get("fast");
  // `depth` is maxDepth only when `nSigFigs` already claimed the sigfigs slot;
  // otherwise it is the sigfigs parameter and must not be read twice.
  const depthStr =
    params.get("maxDepth") ?? (params.has("nSigFigs") ? params.get("depth") : undefined);

  const input: Record<string, unknown> = {
    channel,
    ...(symbol === "" ? {} : { symbol }),
    interval,
    ...(nSigFigsStr !== null && nSigFigsStr !== "" ? { nSigFigs: Number(nSigFigsStr) } : {}),
    ...(dex !== undefined && dex !== "" ? { dex } : {}),
    ...(fastStr !== null && fastStr !== undefined
      ? { fast: fastStr === "true" || fastStr === "1" }
      : {}),
    ...(depthStr !== null && depthStr !== undefined ? { depth: Number(depthStr) } : {}),
  };

  const result = Schema.decodeUnknownResult(SubscriptionSchema)(input);
  if (Result.isFailure(result)) {
    const message =
      nSigFigsStr !== null && nSigFigsStr !== ""
        ? "Invalid nSigFigs/depth. Supported values are 2, 3, 4, 5."
        : channel === ""
          ? "Missing required query parameter: channel"
          : channel === "candle"
            ? `Unsupported interval: ${interval}`
            : `Unsupported channel: ${channel}`;
    return { ok: false, status: 400, message };
  }

  const data = result.success;
  const normalizedSymbol =
    data.symbol !== undefined && data.symbol !== "" ? normalizeSymbol(data.symbol) : undefined;
  return { ok: true, data: { ...data, symbol: normalizedSymbol } };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseJson = (payload: string): unknown => {
  try {
    const parsed: unknown = JSON.parse(payload);
    return parsed;
  } catch {
    return undefined;
  }
};

/** Validates a frame `subscription` through the query-param parser so both transports share one source. */
const parseFrameSubscription = (value: unknown): ParseResult => {
  if (!isRecord(value)) {
    return { ok: false, status: 400, message: "Missing required field: subscription" };
  }

  const params = new URLSearchParams();
  for (const [key, field] of Object.entries(value)) {
    if (field === undefined || field === null) continue;
    if (typeof field === "string" || typeof field === "number" || typeof field === "boolean") {
      params.set(key, String(field));
    }
  }

  return parseMarketWsSubscription(params);
};

export type MarketWsFrame =
  | {
      readonly kind: "subscription";
      readonly action: "subscribe" | "unsubscribe";
      readonly subscription: MarketWsSubscription;
    }
  | { readonly kind: "invalid_subscription"; readonly message: string }
  | { readonly kind: "unsupported" };

export const parseMarketWsFrame = (payload: string): MarketWsFrame => {
  const frame = parseJson(payload);
  if (!isRecord(frame)) return { kind: "unsupported" };

  const type = frame.type;
  if (type !== "subscribe" && type !== "unsubscribe") return { kind: "unsupported" };

  const parsed = parseFrameSubscription(frame.subscription);
  if (!parsed.ok) return { kind: "invalid_subscription", message: parsed.message };

  return { kind: "subscription", action: type, subscription: parsed.data };
};
