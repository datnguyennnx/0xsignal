-- Historical candles are immutable once their interval has closed, so they are
-- safe to persist and serve from Postgres instead of paying Hyperliquid weight
-- on every request. open_time is the candle open in epoch milliseconds.
CREATE TABLE IF NOT EXISTS market_candle_cache (
  symbol TEXT NOT NULL,
  interval TEXT NOT NULL,
  open_time BIGINT NOT NULL,
  open NUMERIC NOT NULL,
  high NUMERIC NOT NULL,
  low NUMERIC NOT NULL,
  close NUMERIC NOT NULL,
  volume NUMERIC NOT NULL,
  PRIMARY KEY (symbol, interval, open_time)
);
