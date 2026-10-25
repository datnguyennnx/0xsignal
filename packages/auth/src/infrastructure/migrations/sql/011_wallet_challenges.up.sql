-- Proof-of-control challenges for wallet linking. One user + address has at
-- most one outstanding row: the issue path deletes the previous challenge, so a
-- nonce is never reusable. consumed_at makes a successfully verified nonce
-- single-use; expires_at bounds it to the short TTL.
CREATE TABLE IF NOT EXISTS wallet_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  nonce TEXT NOT NULL UNIQUE,
  message TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_challenges_user_address
  ON wallet_challenges (user_id, lower(wallet_address));
CREATE INDEX IF NOT EXISTS idx_wallet_challenges_expiry
  ON wallet_challenges (expires_at);
