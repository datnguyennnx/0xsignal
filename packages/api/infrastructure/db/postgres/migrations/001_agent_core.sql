-- Migration: 001_agent_core
-- Description: Agent core tables - sessions, plans, and actions
-- Created: 2026-04-12

-- UP:

-- Agent Sessions: Agent working sessions
CREATE TABLE IF NOT EXISTS agent_sessions (
    id VARCHAR(255) PRIMARY KEY,
    source VARCHAR(255) NOT NULL,
    objective TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    context_scope VARCHAR(255),
    actor_kind VARCHAR(100),
    actor_name VARCHAR(255),
    source_system VARCHAR(255),
    trace_id VARCHAR(100),
    span_id VARCHAR(100),
    correlation_id VARCHAR(100),
    request_id VARCHAR(100),
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_status ON agent_sessions(status);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_trace_id ON agent_sessions(trace_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_correlation_id ON agent_sessions(correlation_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_created_at ON agent_sessions(created_at);

-- Agent Plans: Plan revisions
CREATE TABLE IF NOT EXISTS agent_plans (
    id VARCHAR(255) PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    title VARCHAR(500) NOT NULL,
    content_markdown TEXT,
    structured_plan JSONB,
    trace_id VARCHAR(100),
    span_id VARCHAR(100),
    correlation_id VARCHAR(100),
    request_id VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_plans_session_id ON agent_plans(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_plans_version ON agent_plans(session_id, version);
CREATE INDEX IF NOT EXISTS idx_agent_plans_trace_id ON agent_plans(trace_id);

-- Agent Actions: Action logs
CREATE TABLE IF NOT EXISTS agent_actions (
    id VARCHAR(255) PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
    plan_id VARCHAR(255) REFERENCES agent_plans(id) ON DELETE SET NULL,
    action_type VARCHAR(50) NOT NULL,
    target_type VARCHAR(100),
    target_id VARCHAR(255),
    input_payload JSONB,
    result_payload JSONB,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    error_code VARCHAR(100),
    error_message TEXT,
    trace_id VARCHAR(100),
    span_id VARCHAR(100),
    correlation_id VARCHAR(100),
    request_id VARCHAR(100),
    parent_span_id VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_actions_session_id ON agent_actions(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_actions_plan_id ON agent_actions(plan_id);
CREATE INDEX IF NOT EXISTS idx_agent_actions_status ON agent_actions(status);
CREATE INDEX IF NOT EXISTS idx_agent_actions_trace_id ON agent_actions(trace_id);
CREATE INDEX IF NOT EXISTS idx_agent_actions_correlation_id ON agent_actions(correlation_id);
CREATE INDEX IF NOT EXISTS idx_agent_actions_created_at ON agent_actions(created_at);

-- DOWN:

DROP TABLE IF EXISTS agent_actions CASCADE;
DROP TABLE IF EXISTS agent_plans CASCADE;
DROP TABLE IF EXISTS agent_sessions CASCADE;