-- Migration: 003_market_data
-- Description: Market data tables - candlestick requests and dataset snapshots
-- Created: 2026-04-12

-- UP:

-- Candlestick Requests: Market data requests
CREATE TABLE IF NOT EXISTS candlestick_requests (
    id VARCHAR(255) PRIMARY KEY,
    session_id VARCHAR(255) REFERENCES agent_sessions(id) ON DELETE SET NULL,
    symbol VARCHAR(50) NOT NULL,
    exchange VARCHAR(100) NOT NULL,
    base_timeframe VARCHAR(20) NOT NULL,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    adjustments JSONB,
    requested_by_action_id VARCHAR(255),
    trace_id VARCHAR(100),
    span_id VARCHAR(100),
    correlation_id VARCHAR(100),
    request_id VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_candlestick_requests_session_id ON candlestick_requests(session_id);
CREATE INDEX IF NOT EXISTS idx_candlestick_requests_symbol ON candlestick_requests(symbol);
CREATE INDEX IF NOT EXISTS idx_candlestick_requests_exchange ON candlestick_requests(exchange);
CREATE INDEX IF NOT EXISTS idx_candlestick_requests_timeframe ON candlestick_requests(base_timeframe);
CREATE INDEX IF NOT EXISTS idx_candlestick_requests_trace_id ON candlestick_requests(trace_id);
CREATE INDEX IF NOT EXISTS idx_candlestick_requests_correlation_id ON candlestick_requests(correlation_id);
CREATE INDEX IF NOT EXISTS idx_candlestick_requests_created_at ON candlestick_requests(created_at);

-- Dataset Snapshots: Frozen candlestick data
CREATE TABLE IF NOT EXISTS dataset_snapshots (
    id VARCHAR(255) PRIMARY KEY,
    request_id VARCHAR(255) NOT NULL REFERENCES candlestick_requests(id) ON DELETE CASCADE,
    symbol VARCHAR(50) NOT NULL,
    exchange VARCHAR(100) NOT NULL,
    timeframe VARCHAR(20) NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    query_fingerprint VARCHAR(100),
    row_count INTEGER NOT NULL DEFAULT 0,
    checksum VARCHAR(100),
    source_series JSONB,
    trace_id VARCHAR(100),
    span_id VARCHAR(100),
    correlation_id VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dataset_snapshots_request_id ON dataset_snapshots(request_id);
CREATE INDEX IF NOT EXISTS idx_dataset_snapshots_symbol ON dataset_snapshots(symbol);
CREATE INDEX IF NOT EXISTS idx_dataset_snapshots_exchange ON dataset_snapshots(exchange);
CREATE INDEX IF NOT EXISTS idx_dataset_snapshots_timeframe ON dataset_snapshots(timeframe);
CREATE INDEX IF NOT EXISTS idx_dataset_snapshots_time_range ON dataset_snapshots(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_dataset_snapshots_trace_id ON dataset_snapshots(trace_id);
CREATE INDEX IF NOT EXISTS idx_dataset_snapshots_created_at ON dataset_snapshots(created_at);

-- DOWN:

DROP TABLE IF EXISTS dataset_snapshots CASCADE;
DROP TABLE IF EXISTS candlestick_requests CASCADE;