-- Migration: 002_strategy_core
-- Description: Strategy core tables - definitions, versions, and change records
-- Created: 2026-04-12

-- UP:

-- Strategy Definitions: Strategy identity
CREATE TABLE IF NOT EXISTS strategy_definitions (
    id VARCHAR(255) PRIMARY KEY,
    slug VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(500) NOT NULL,
    market_type VARCHAR(50) NOT NULL,
    owner_type VARCHAR(50) NOT NULL DEFAULT 'user',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_strategy_definitions_slug ON strategy_definitions(slug);
CREATE INDEX IF NOT EXISTS idx_strategy_definitions_market_type ON strategy_definitions(market_type);
CREATE INDEX IF NOT EXISTS idx_strategy_definitions_owner_type ON strategy_definitions(owner_type);
CREATE INDEX IF NOT EXISTS idx_strategy_definitions_created_at ON strategy_definitions(created_at);

-- Strategy Versions: Immutable strategy snapshots
CREATE TABLE IF NOT EXISTS strategy_versions (
    id VARCHAR(255) PRIMARY KEY,
    strategy_id VARCHAR(255) NOT NULL REFERENCES strategy_definitions(id) ON DELETE CASCADE,
    parent_version_id VARCHAR(255) REFERENCES strategy_versions(id) ON DELETE SET NULL,
    version INTEGER NOT NULL,
    config JSONB NOT NULL,
    change_reason VARCHAR(500),
    created_by_action_id VARCHAR(255),
    schema_version VARCHAR(50) NOT NULL,
    trace_id VARCHAR(100),
    span_id VARCHAR(100),
    correlation_id VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_strategy_versions_strategy_id ON strategy_versions(strategy_id);
CREATE INDEX IF NOT EXISTS idx_strategy_versions_strategy_version ON strategy_versions(strategy_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_strategy_versions_parent_version_id ON strategy_versions(parent_version_id);
CREATE INDEX IF NOT EXISTS idx_strategy_versions_created_by_action_id ON strategy_versions(created_by_action_id);
CREATE INDEX IF NOT EXISTS idx_strategy_versions_trace_id ON strategy_versions(trace_id);
CREATE INDEX IF NOT EXISTS idx_strategy_versions_created_at ON strategy_versions(created_at);

-- Strategy Change Records: Version diffs
CREATE TABLE IF NOT EXISTS strategy_change_records (
    id VARCHAR(255) PRIMARY KEY,
    strategy_version_id VARCHAR(255) NOT NULL REFERENCES strategy_versions(id) ON DELETE CASCADE,
    change_type VARCHAR(50) NOT NULL,
    path VARCHAR(500) NOT NULL,
    previous_value JSONB,
    next_value JSONB,
    summary VARCHAR(500),
    trace_id VARCHAR(100),
    span_id VARCHAR(100),
    correlation_id VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_strategy_change_records_version_id ON strategy_change_records(strategy_version_id);
CREATE INDEX IF NOT EXISTS idx_strategy_change_records_change_type ON strategy_change_records(change_type);
CREATE INDEX IF NOT EXISTS idx_strategy_change_records_path ON strategy_change_records(path);
CREATE INDEX IF NOT EXISTS idx_strategy_change_records_trace_id ON strategy_change_records(trace_id);
CREATE INDEX IF NOT EXISTS idx_strategy_change_records_created_at ON strategy_change_records(created_at);

-- DOWN:

DROP TABLE IF EXISTS strategy_change_records CASCADE;
DROP TABLE IF EXISTS strategy_versions CASCADE;
DROP TABLE IF EXISTS strategy_definitions CASCADE;