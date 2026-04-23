-- Migration: 008_backtest_lifecycle_hardening
-- Description: Standardize backtest run status and mcp interaction status
-- Created: 2026-04-23

-- UP:

-- 1. Update backtest_runs status
ALTER TABLE backtest_runs ALTER COLUMN status SET DEFAULT 'queued';

-- Convert any existing 'pending' to 'queued' to satisfy the new constraint
UPDATE backtest_runs SET status = 'queued' WHERE status = 'pending';

ALTER TABLE backtest_runs
  ADD CONSTRAINT chk_backtest_runs_status
  CHECK (status IN ('queued', 'pending', 'running', 'completed', 'failed', 'initialized', 'preparing', 'cancelling', 'cancelled'));

-- 2. Update mcp_interactions status
ALTER TABLE mcp_interactions DROP CONSTRAINT IF EXISTS chk_mcp_interactions_status;

ALTER TABLE mcp_interactions
  ADD CONSTRAINT chk_mcp_interactions_status
  CHECK (status IN ('pending', 'running', 'completed', 'error', 'failed'));

-- DOWN:

ALTER TABLE mcp_interactions DROP CONSTRAINT IF EXISTS chk_mcp_interactions_status;

ALTER TABLE mcp_interactions
  ADD CONSTRAINT chk_mcp_interactions_status
  CHECK (status IN ('pending', 'running', 'completed', 'failed'));

ALTER TABLE backtest_runs DROP CONSTRAINT IF EXISTS chk_backtest_runs_status;

ALTER TABLE backtest_runs ALTER COLUMN status SET DEFAULT 'pending';
