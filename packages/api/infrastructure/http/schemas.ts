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
  name: Schema.optional(Schema.String),
  image: Schema.optional(Schema.String),
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

// CoinGecko Treasury schemas (Public Treasury Endpoints - Nov 2025)
export const TreasuryCompanySchema = Schema.Struct({
  name: Schema.String,
  symbol: Schema.String,
  country: Schema.String,
  total_holdings: Schema.Number,
  total_entry_value_usd: Schema.Number,
  total_current_value_usd: Schema.Number,
  percentage_of_total_supply: Schema.Number,
});

export const TreasuryHoldingsByCoinSchema = Schema.Struct({
  total_holdings: Schema.Number,
  total_value_usd: Schema.Number,
  market_cap_dominance: Schema.Number,
  companies: Schema.Array(TreasuryCompanySchema),
});

export const TreasuryTransactionSchema = Schema.Struct({
  date: Schema.Number,
  source_url: Schema.NullOr(Schema.String),
  coin_id: Schema.String,
  type: Schema.String,
  holding_net_change: Schema.Number,
  transaction_value_usd: Schema.Number,
  holding_balance: Schema.Number,
  average_entry_value_usd: Schema.Number,
});

export const TreasuryEntitySchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  symbol: Schema.String,
  country: Schema.String,
  total_holdings: Schema.Number,
  total_entry_value_usd: Schema.Number,
  total_current_value_usd: Schema.Number,
  percentage_of_total_supply: Schema.Number,
});

export const TreasuryHistoricalChartSchema = Schema.Struct({
  holdings: Schema.Array(Schema.Tuple(Schema.Number, Schema.Number)),
  holding_value_in_usd: Schema.Array(Schema.Tuple(Schema.Number, Schema.Number)),
});

// Hyperliquid schemas
export const HyperliquidCandleSchema = Schema.Struct({
  t: Schema.Number, // Open time (ms)
  T: Schema.Number, // Close time (ms)
  o: Schema.String, // Open price
  h: Schema.String, // High price
  l: Schema.String, // Low price
  c: Schema.String, // Close price
  v: Schema.String, // Volume
  n: Schema.Number, // Number of trades
  i: Schema.String, // Interval
  s: Schema.String, // Symbol
});

// Type exports
export type CoinGeckoMarketItem = typeof CoinGeckoMarketItemSchema.Type;
export type TreasuryCompany = typeof TreasuryCompanySchema.Type;
export type TreasuryHoldingsByCoin = typeof TreasuryHoldingsByCoinSchema.Type;
export type TreasuryTransaction = typeof TreasuryTransactionSchema.Type;
export type TreasuryEntity = typeof TreasuryEntitySchema.Type;
export type TreasuryHistoricalChart = typeof TreasuryHistoricalChartSchema.Type;
export type HyperliquidCandle = typeof HyperliquidCandleSchema.Type;
