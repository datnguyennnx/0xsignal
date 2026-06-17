import { Schema } from "effect";
import { normalizeSymbol } from "../../../infrastructure/data-sources/hyperliquid/symbol";
import { WS_MARKET_INTERVALS } from "@0xsignal/shared";
import type { MarketWsSubscription } from "../../../infrastructure/streams/hyperliquid/hub-types";

export type ParseResult =
  | { readonly ok: true; readonly data: MarketWsSubscription }
  | { readonly ok: false; readonly status: number; readonly message: string };

// --- Schema definitions ---
// Each subscription variant is a tagged struct; Schema.Union resolves
// the correct variant based on the `channel` discriminator.

const IntervalSchema = Schema.Literals(WS_MARKET_INTERVALS);
const NSigFigsSchema = Schema.Literals([2, 3, 4, 5]);

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
});

const TradesSchema = Schema.Struct({
  channel: Schema.Literal("trades"),
  symbol: Schema.NonEmptyString,
});

const SubscriptionSchema = Schema.Union([AllMidsSchema, CandleSchema, L2BookSchema, TradesSchema]);

export const parseMarketWsSubscription = (params: URLSearchParams): ParseResult => {
  // Extract raw values from URLSearchParams (data extraction — not validation)
  const channel = (params.get("channel") ?? params.get("type") ?? "").trim();
  const symbol = params.get("symbol") ?? params.get("coin") ?? "";
  const interval = (params.get("interval") ?? "1m").trim();
  const nSigFigsStr = params.get("nSigFigs") ?? params.get("depth");
  const dex = params.get("dex")?.trim();

  // Build input — Schema.Union resolves the correct variant by channel discriminator.
  // Extra fields for non-matching variants are silently ignored by the Union.
  const input: Record<string, unknown> = {
    channel,
    ...(symbol ? { symbol } : {}),
    interval,
    ...(nSigFigsStr ? { nSigFigs: Number(nSigFigsStr) } : {}),
    ...(dex ? { dex } : {}),
  };

  // Schema handles ALL validation: channel, symbol, interval, nSigFigs
  const result = Schema.decodeUnknownResult(SubscriptionSchema)(input);
  if (result._tag === "Failure") {
    // Schema performed validation; we present a human-readable error.
    // Raw input values are available in the closure for error formatting.
    const message = nSigFigsStr
      ? "Invalid nSigFigs/depth. Supported values are 2, 3, 4, 5."
      : !channel
        ? "Missing required query parameter: channel"
        : channel === "candle"
          ? `Unsupported interval: ${interval}`
          : `Unsupported channel: ${channel}`;
    return { ok: false, status: 400, message };
  }

  // Apply normalizeSymbol after Schema validation (domain transformation)
  const data = result.success;
  const normalizedSymbol = data.symbol ? normalizeSymbol(data.symbol) : undefined;
  return { ok: true, data: { ...data, symbol: normalizedSymbol } };
};
