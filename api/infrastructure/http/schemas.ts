/**
 * HTTP Response Schemas
 * Runtime validation for external API responses using @effect/schema
 */

import { Schema } from "effect";

// CoinGecko simple price response
export const CoinGeckoSimplePriceSchema = Schema.Record({
  key: Schema.String,
  value: Schema.Struct({
    usd: Schema.Number,
    usd_market_cap: Schema.optional(Schema.Number),
    usd_24h_vol: Schema.optional(Schema.Number),
    usd_24h_change: Schema.optional(Schema.Number),
  }),
});

// CoinGecko markets response item
export const CoinGeckoMarketItemSchema = Schema.Struct({
  id: Schema.String,
  symbol: Schema.String,
  current_price: Schema.Number,
  market_cap: Schema.Number,
  total_volume: Schema.Number,
  price_change_percentage_24h: Schema.NullOr(Schema.Number),
  last_updated: Schema.String,
  high_24h: Schema.NullOr(Schema.Number),
  low_24h: Schema.NullOr(Schema.Number),
  circulating_supply: Schema.NullOr(Schema.Number),
  total_supply: Schema.NullOr(Schema.Number),
  max_supply: Schema.NullOr(Schema.Number),
  ath: Schema.NullOr(Schema.Number),
  ath_change_percentage: Schema.NullOr(Schema.Number),
  atl: Schema.NullOr(Schema.Number),
  atl_change_percentage: Schema.NullOr(Schema.Number),
});

export const CoinGeckoMarketsSchema = Schema.Array(CoinGeckoMarketItemSchema);

// Binance futures schemas
export const BinanceOpenInterestSchema = Schema.Struct({
  symbol: Schema.String,
  openInterest: Schema.String,
  time: Schema.Number,
});

export const BinanceTickerSchema = Schema.Struct({
  symbol: Schema.String,
  priceChange: Schema.String,
  priceChangePercent: Schema.String,
  lastPrice: Schema.String,
  highPrice: Schema.String,
  lowPrice: Schema.String,
  volume: Schema.String,
  quoteVolume: Schema.String,
});

export const BinancePremiumIndexSchema = Schema.Struct({
  symbol: Schema.String,
  markPrice: Schema.String,
  indexPrice: Schema.String,
  lastFundingRate: Schema.String,
  nextFundingTime: Schema.Number,
  time: Schema.Number,
});

export const BinanceExchangeInfoSchema = Schema.Struct({
  symbols: Schema.Array(
    Schema.Struct({
      symbol: Schema.String,
      status: Schema.String,
      baseAsset: Schema.String,
      quoteAsset: Schema.String,
    })
  ),
});

// DefiLlama schemas
export const DefiLlamaProtocolSchema = Schema.Struct({
  name: Schema.String,
  displayName: Schema.optional(Schema.String),
  symbol: Schema.optional(Schema.String),
  gecko_id: Schema.NullOr(Schema.String),
  logo: Schema.optional(Schema.NullOr(Schema.String)),
  url: Schema.optional(Schema.NullOr(Schema.String)),
  category: Schema.optional(Schema.String),
  chains: Schema.optional(Schema.Array(Schema.String)),
  total24h: Schema.optional(Schema.Number),
  total7d: Schema.optional(Schema.Number),
  total30d: Schema.optional(Schema.Number),
  revenue24h: Schema.optional(Schema.Number),
  revenue7d: Schema.optional(Schema.Number),
  revenue30d: Schema.optional(Schema.Number),
});

export const DefiLlamaFeesResponseSchema = Schema.Struct({
  protocols: Schema.optional(Schema.Array(DefiLlamaProtocolSchema)),
  totalFees24h: Schema.optional(Schema.Number),
  totalRevenue24h: Schema.optional(Schema.Number),
});

// Type exports
export type CoinGeckoMarketItem = typeof CoinGeckoMarketItemSchema.Type;
export type BinanceOpenInterest = typeof BinanceOpenInterestSchema.Type;
export type BinanceTicker = typeof BinanceTickerSchema.Type;
export type BinancePremiumIndex = typeof BinancePremiumIndexSchema.Type;
export type DefiLlamaProtocol = typeof DefiLlamaProtocolSchema.Type;
