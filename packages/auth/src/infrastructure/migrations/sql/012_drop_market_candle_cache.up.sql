-- Candles are no longer persisted: the store reads every range straight from
-- Hyperliquid, so this cache has no writer and no reader left.
DROP TABLE IF EXISTS market_candle_cache;
