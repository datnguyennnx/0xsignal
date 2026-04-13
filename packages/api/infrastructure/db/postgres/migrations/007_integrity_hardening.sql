-- Migration: 007_integrity_hardening
-- Description: Lineage semantics and relational invariants hardening
-- Created: 2026-04-13

-- UP:

ALTER TABLE candlestick_requests
  ADD COLUMN IF NOT EXISTS requested_by_interaction_id VARCHAR(255);

ALTER TABLE candlestick_requests
  ADD CONSTRAINT fk_candlestick_requests_requested_by_interaction
  FOREIGN KEY (requested_by_interaction_id) REFERENCES mcp_interactions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_candlestick_requests_requested_by_interaction_id
  ON candlestick_requests(requested_by_interaction_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_agent_plans_session_version
  ON agent_plans(session_id, version);

CREATE UNIQUE INDEX IF NOT EXISTS uq_strategy_versions_strategy_version
  ON strategy_versions(strategy_id, version);

ALTER TABLE research_notes
  ADD CONSTRAINT chk_research_notes_anchor
  CHECK (
    session_id IS NOT NULL
    OR run_id IS NOT NULL
    OR strategy_version_id IS NOT NULL
  );

ALTER TABLE artifacts
  ADD CONSTRAINT chk_artifacts_anchor
  CHECK (
    run_id IS NOT NULL
    OR strategy_version_id IS NOT NULL
  );

ALTER TABLE mcp_interactions
  ADD CONSTRAINT chk_mcp_interactions_interaction_type
  CHECK (interaction_type IN ('tool_call', 'resource_access', 'prompt', 'message'));

ALTER TABLE mcp_interactions
  ADD CONSTRAINT chk_mcp_interactions_status
  CHECK (status IN ('pending', 'running', 'completed', 'failed'));

-- DOWN:

ALTER TABLE mcp_interactions DROP CONSTRAINT IF EXISTS chk_mcp_interactions_status;
ALTER TABLE mcp_interactions DROP CONSTRAINT IF EXISTS chk_mcp_interactions_interaction_type;

ALTER TABLE artifacts DROP CONSTRAINT IF EXISTS chk_artifacts_anchor;
ALTER TABLE research_notes DROP CONSTRAINT IF EXISTS chk_research_notes_anchor;

DROP INDEX IF EXISTS uq_strategy_versions_strategy_version;
DROP INDEX IF EXISTS uq_agent_plans_session_version;

DROP INDEX IF EXISTS idx_candlestick_requests_requested_by_interaction_id;

ALTER TABLE candlestick_requests
  DROP CONSTRAINT IF EXISTS fk_candlestick_requests_requested_by_interaction;

ALTER TABLE candlestick_requests
  DROP COLUMN IF EXISTS requested_by_interaction_id;
