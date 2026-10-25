-- Informational record of agent approvals. No key material: the wallet owns and
-- signs with the agent key; the backend only remembers that an approval exists.
CREATE TABLE IF NOT EXISTS agent_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id UUID REFERENCES exchange_accounts(id) ON DELETE CASCADE,
  agent_address TEXT NOT NULL,
  credential_subtype TEXT,
  label TEXT,
  permissions JSONB,
  expires_at TIMESTAMPTZ,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'legacy_api_credentials',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_registrations_user_created
  ON agent_registrations (user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_registrations_account_agent
  ON agent_registrations (account_id, agent_address);

-- Preserve what api_credentials told us about live approvals before 008 drops it.
-- Rows without an agent_address carry no agent approval and cannot satisfy the
-- NOT NULL target, so they are not copied.
INSERT INTO agent_registrations
  (user_id, account_id, agent_address, credential_subtype, label,
   permissions, expires_at, is_verified, verified_at, created_at)
SELECT ac.user_id, ac.account_id, ac.agent_address, ac.credential_subtype, ac.label,
       to_jsonb(ac.permissions), ac.expires_at, ac.is_verified, ac.verified_at, ac.created_at
FROM api_credentials ac
WHERE ac.agent_address IS NOT NULL
ON CONFLICT DO NOTHING;
