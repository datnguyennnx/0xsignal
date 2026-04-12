-- Migration: 005_research_core
-- Description: Research tables - notes and artifacts
-- Created: 2026-04-12

-- UP:

-- Research Notes: Notes attached to strategies/runs
CREATE TABLE IF NOT EXISTS research_notes (
    id VARCHAR(255) PRIMARY KEY,
    session_id VARCHAR(255) REFERENCES agent_sessions(id) ON DELETE SET NULL,
    run_id VARCHAR(255) REFERENCES backtest_runs(id) ON DELETE SET NULL,
    strategy_version_id VARCHAR(255) REFERENCES strategy_versions(id) ON DELETE SET NULL,
    title VARCHAR(500) NOT NULL,
    content_markdown TEXT,
    tags TEXT[],
    trace_id VARCHAR(100),
    span_id VARCHAR(100),
    correlation_id VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_research_notes_session_id ON research_notes(session_id);
CREATE INDEX IF NOT EXISTS idx_research_notes_run_id ON research_notes(run_id);
CREATE INDEX IF NOT EXISTS idx_research_notes_strategy_version_id ON research_notes(strategy_version_id);
CREATE INDEX IF NOT EXISTS idx_research_notes_trace_id ON research_notes(trace_id);
CREATE INDEX IF NOT EXISTS idx_research_notes_created_at ON research_notes(created_at);

-- Artifacts: Generated outputs metadata
CREATE TABLE IF NOT EXISTS artifacts (
    id VARCHAR(255) PRIMARY KEY,
    run_id VARCHAR(255) REFERENCES backtest_runs(id) ON DELETE SET NULL,
    strategy_version_id VARCHAR(255) REFERENCES strategy_versions(id) ON DELETE SET NULL,
    artifact_type VARCHAR(50) NOT NULL,
    storage_path VARCHAR(1000) NOT NULL,
    content_type VARCHAR(100),
    size_bytes BIGINT,
    metadata JSONB,
    trace_id VARCHAR(100),
    span_id VARCHAR(100),
    correlation_id VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_artifacts_run_id ON artifacts(run_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_strategy_version_id ON artifacts(strategy_version_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_artifact_type ON artifacts(artifact_type);
CREATE INDEX IF NOT EXISTS idx_artifacts_trace_id ON artifacts(trace_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_created_at ON artifacts(created_at);

-- DOWN:

DROP TABLE IF EXISTS artifacts CASCADE;
DROP TABLE IF EXISTS research_notes CASCADE;