/**
 * HTTP Response Schemas
 * Runtime validation for external API responses using @effect/schema
 */

import { Schema } from "effect";

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

// Type exports
export type CoinGeckoMarketItem = typeof CoinGeckoMarketItemSchema.Type;
