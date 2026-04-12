-- Migration: 006_mcp_core
-- Description: MCP transport-level traceability
-- Created: 2026-04-12

-- UP:

-- MCP Interactions: MCP transport-level traceability
CREATE TABLE IF NOT EXISTS mcp_interactions (
    id VARCHAR(255) PRIMARY KEY,
    session_id VARCHAR(255) REFERENCES agent_sessions(id) ON DELETE SET NULL,
    interaction_type VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    input_payload JSONB,
    output_payload JSONB,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    trace_id VARCHAR(100),
    span_id VARCHAR(100),
    correlation_id VARCHAR(100),
    request_id VARCHAR(100),
    parent_span_id VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mcp_interactions_session_id ON mcp_interactions(session_id);
CREATE INDEX IF NOT EXISTS idx_mcp_interactions_interaction_type ON mcp_interactions(interaction_type);
CREATE INDEX IF NOT EXISTS idx_mcp_interactions_name ON mcp_interactions(name);
CREATE INDEX IF NOT EXISTS idx_mcp_interactions_status ON mcp_interactions(status);
CREATE INDEX IF NOT EXISTS idx_mcp_interactions_trace_id ON mcp_interactions(trace_id);
CREATE INDEX IF NOT EXISTS idx_mcp_interactions_correlation_id ON mcp_interactions(correlation_id);
CREATE INDEX IF NOT EXISTS idx_mcp_interactions_request_id ON mcp_interactions(request_id);
CREATE INDEX IF NOT EXISTS idx_mcp_interactions_parent_span_id ON mcp_interactions(parent_span_id);
CREATE INDEX IF NOT EXISTS idx_mcp_interactions_created_at ON mcp_interactions(created_at);

-- DOWN:

DROP TABLE IF EXISTS mcp_interactions CASCADE;