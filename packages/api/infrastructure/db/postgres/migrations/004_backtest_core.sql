-- Migration: 004_backtest_core
-- Description: Backtest core tables - runs, inputs, metrics, and events
-- Created: 2026-04-12

-- UP:

-- Backtest Runs: Run metadata (deferred FK for cross-table refs)
CREATE TABLE IF NOT EXISTS backtest_runs (
    id VARCHAR(255) PRIMARY KEY,
    session_id VARCHAR(255) REFERENCES agent_sessions(id) ON DELETE SET NULL,
    strategy_version_id VARCHAR(255) NOT NULL REFERENCES strategy_versions(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
    dataset_snapshot_id VARCHAR(255) NOT NULL REFERENCES dataset_snapshots(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    engine_version VARCHAR(50) NOT NULL,
    run_mode VARCHAR(20) NOT NULL DEFAULT 'backtest',
    initial_capital DECIMAL(20, 2) NOT NULL,
    base_currency VARCHAR(20) NOT NULL,
    created_by_action_id VARCHAR(255),
    trace_id VARCHAR(100),
    span_id VARCHAR(100),
    correlation_id VARCHAR(100),
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backtest_runs_session_id ON backtest_runs(session_id);
CREATE INDEX IF NOT EXISTS idx_backtest_runs_strategy_version_id ON backtest_runs(strategy_version_id);
CREATE INDEX IF NOT EXISTS idx_backtest_runs_dataset_snapshot_id ON backtest_runs(dataset_snapshot_id);
CREATE INDEX IF NOT EXISTS idx_backtest_runs_status ON backtest_runs(status);
CREATE INDEX IF NOT EXISTS idx_backtest_runs_trace_id ON backtest_runs(trace_id);
CREATE INDEX IF NOT EXISTS idx_backtest_runs_created_at ON backtest_runs(created_at);

-- Backtest Run Inputs: Frozen execution inputs
CREATE TABLE IF NOT EXISTS backtest_run_inputs (
    run_id VARCHAR(255) PRIMARY KEY REFERENCES backtest_runs(id) ON DELETE CASCADE,
    strategy_snapshot JSONB NOT NULL,
    dataset_snapshot_ref JSONB NOT NULL,
    execution_options JSONB,
    schema_version VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Backtest Metrics: Flat normalized metrics
CREATE TABLE IF NOT EXISTS backtest_metrics (
    id SERIAL PRIMARY KEY,
    run_id VARCHAR(255) NOT NULL REFERENCES backtest_runs(id) ON DELETE CASCADE,
    metric_key VARCHAR(100) NOT NULL,
    metric_value DECIMAL(20, 8) NOT NULL,
    metric_group VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backtest_metrics_run_id ON backtest_metrics(run_id);
CREATE INDEX IF NOT EXISTS idx_backtest_metrics_metric_key ON backtest_metrics(metric_key);
CREATE INDEX IF NOT EXISTS idx_backtest_metrics_metric_group ON backtest_metrics(metric_group);
CREATE UNIQUE INDEX IF NOT EXISTS idx_backtest_metrics_unique ON backtest_metrics(run_id, metric_key);

-- Backtest Events: Append-only lifecycle events
CREATE TABLE IF NOT EXISTS backtest_events (
    id VARCHAR(255) PRIMARY KEY,
    run_id VARCHAR(255) NOT NULL REFERENCES backtest_runs(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    payload JSONB,
    level VARCHAR(20) NOT NULL DEFAULT 'info',
    trace_id VARCHAR(100),
    span_id VARCHAR(100),
    correlation_id VARCHAR(100),
    parent_span_id VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backtest_events_run_id ON backtest_events(run_id);
CREATE INDEX IF NOT EXISTS idx_backtest_events_event_type ON backtest_events(event_type);
CREATE INDEX IF NOT EXISTS idx_backtest_events_level ON backtest_events(level);
CREATE INDEX IF NOT EXISTS idx_backtest_events_trace_id ON backtest_events(trace_id);
CREATE INDEX IF NOT EXISTS idx_backtest_events_created_at ON backtest_events(created_at);

-- DOWN:

DROP TABLE IF EXISTS backtest_events CASCADE;
DROP TABLE IF EXISTS backtest_metrics CASCADE;
DROP TABLE IF EXISTS backtest_run_inputs CASCADE;
DROP TABLE IF EXISTS backtest_runs CASCADE;