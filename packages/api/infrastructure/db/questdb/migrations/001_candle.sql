-- Migration: 001_candle
-- Description: Initial schema for candle market data
-- Created: 2026-04-23

CREATE TABLE IF NOT EXISTS candle (
  symbol SYMBOL,
  exchange SYMBOL,
  timeframe SYMBOL,
  open DOUBLE,
  high DOUBLE,
  low DOUBLE,
  close DOUBLE,
  volume DOUBLE,
  timestamp TIMESTAMP
) timestamp(timestamp) PARTITION BY DAY WAL;
