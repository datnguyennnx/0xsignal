-- Depends on 001_init

-- exchanges (catalog, seeded at deploy)
CREATE TABLE IF NOT EXISTS exchanges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  chain TEXT NOT NULL,
  supports_sub_accounts BOOLEAN NOT NULL DEFAULT false,
  supports_agent_wallets BOOLEAN NOT NULL DEFAULT false,
  supports_vaults BOOLEAN NOT NULL DEFAULT false,
  config JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO exchanges (slug, name, chain, supports_sub_accounts, supports_agent_wallets, supports_vaults)
  VALUES
    ('hyperliquid', 'Hyperliquid', 'arbitrum', true,  true,  true)
  ON CONFLICT (slug) DO NOTHING;

-- exchange_accounts
CREATE TABLE IF NOT EXISTS exchange_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exchange_id UUID NOT NULL REFERENCES exchanges(id),
  node_type TEXT NOT NULL DEFAULT 'wallet' CHECK (node_type IN ('wallet', 'sub', 'vault')),
  parent_id UUID REFERENCES exchange_accounts(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  chain TEXT,
  label TEXT NOT NULL DEFAULT '',
  color TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, exchange_id, label),
  CONSTRAINT chk_node_type_wallet
    CHECK ((node_type = 'wallet' AND parent_id IS NULL) OR (node_type <> 'wallet' AND parent_id IS NOT NULL)),
  CONSTRAINT chk_exchange_account_no_self_ref CHECK (id <> parent_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_exchange_accounts_primary
  ON exchange_accounts (user_id, exchange_id) WHERE is_primary = true;
CREATE INDEX IF NOT EXISTS idx_exchange_accounts_user_id
  ON exchange_accounts (user_id);
CREATE INDEX IF NOT EXISTS idx_exchange_accounts_user_exchange
  ON exchange_accounts (user_id, exchange_id);
CREATE INDEX IF NOT EXISTS idx_exchange_accounts_parent
  ON exchange_accounts (parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_exchange_accounts_wallet
  ON exchange_accounts (wallet_address);

-- api_credentials
CREATE TABLE IF NOT EXISTS api_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES exchange_accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_subtype TEXT NOT NULL CHECK (credential_subtype IN ('agent', 'eoa', 'hardware')),
  label TEXT NOT NULL DEFAULT '',
  agent_address TEXT,
  enc_agent_key TEXT,
  enc_eoa_key TEXT,
  derivation_path TEXT,
  permissions TEXT[] NOT NULL DEFAULT '{}',
  ip_whitelist INET[],
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_revoked BOOLEAN NOT NULL DEFAULT false,
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,
  rotated_from UUID REFERENCES api_credentials(id),
  encryption_version SMALLINT NOT NULL DEFAULT 1,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (account_id, label),
  CONSTRAINT chk_revoked_consistency CHECK (is_revoked = (revoked_at IS NOT NULL)),
  CONSTRAINT chk_active_not_revoked CHECK (NOT (is_active = true AND is_revoked = true)),
  CONSTRAINT chk_agent_fields CHECK (credential_subtype <> 'agent' OR (agent_address IS NOT NULL AND enc_agent_key IS NOT NULL)),
  CONSTRAINT chk_eoa_fields CHECK (credential_subtype <> 'eoa' OR enc_eoa_key IS NOT NULL),
  CONSTRAINT chk_hardware_fields CHECK (credential_subtype <> 'hardware' OR derivation_path IS NOT NULL),
  CONSTRAINT chk_api_cred_no_self_ref CHECK (id <> rotated_from)
);

CREATE INDEX IF NOT EXISTS idx_api_credentials_account
  ON api_credentials (account_id);
CREATE INDEX IF NOT EXISTS idx_api_credentials_user
  ON api_credentials (user_id);
CREATE INDEX IF NOT EXISTS idx_api_credentials_active
  ON api_credentials (account_id, credential_subtype) WHERE is_active = true AND is_revoked = false;
CREATE INDEX IF NOT EXISTS idx_api_credentials_rotated
  ON api_credentials (rotated_from) WHERE rotated_from IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_api_credentials_expires
  ON api_credentials (expires_at) WHERE expires_at IS NOT NULL AND is_active = true AND is_revoked = false;
CREATE INDEX IF NOT EXISTS idx_api_credentials_agent
  ON api_credentials (agent_address) WHERE agent_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_api_credentials_unverified
  ON api_credentials (is_verified) WHERE is_verified = false AND is_active = true AND is_revoked = false;

-- credential_audit_log (append-only)
CREATE TABLE IF NOT EXISTS credential_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  account_id UUID,
  credential_id UUID,
  action TEXT NOT NULL CHECK (action IN (
    'created', 'updated', 'deleted', 'read', 'exported',
    'verified', 'verification_failed', 'revoked', 'reactivated',
    'expired', 'rotated', 'permission_updated', 'label_updated',
    'ip_whitelist_updated', 'credential_type_updated',
    'login_success', 'login_failed', 'suspended', 'unsuspended'
  )),
  actor_type TEXT NOT NULL DEFAULT 'user' CHECK (actor_type IN ('user', 'system', 'admin')),
  ip_address INET,
  user_agent TEXT,
  request_id TEXT,
  context JSONB NOT NULL DEFAULT '{}',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user
  ON credential_audit_log (user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_credential
  ON credential_audit_log (credential_id, occurred_at DESC) WHERE credential_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_log_action
  ON credential_audit_log (action, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_occurred
  ON credential_audit_log (occurred_at DESC);

CREATE OR REPLACE RULE no_update_audit_log AS
  ON UPDATE TO credential_audit_log DO INSTEAD NOTHING;
CREATE OR REPLACE RULE no_delete_audit_log AS
  ON DELETE TO credential_audit_log DO INSTEAD NOTHING;

-- Triggers (set_updated_at already exists from 001_init)
DROP TRIGGER IF EXISTS exchanges_updated_at ON exchanges;
CREATE TRIGGER exchanges_updated_at
  BEFORE UPDATE ON exchanges FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS exchange_accounts_updated_at ON exchange_accounts;
CREATE TRIGGER exchange_accounts_updated_at
  BEFORE UPDATE ON exchange_accounts FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS api_credentials_updated_at ON api_credentials;
CREATE TRIGGER api_credentials_updated_at
  BEFORE UPDATE ON api_credentials FOR EACH ROW EXECUTE FUNCTION set_updated_at();
