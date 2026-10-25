-- Wallet ownership is proven by a signed challenge, not by a row's existence.
-- verified_at records that proof; the nonce is kept only for traceability.
ALTER TABLE exchange_accounts
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_nonce TEXT;

-- Backfill trust only where the address is unambiguous. Duplicated addresses
-- stay NULL for every row: neither user is trusted until one of them signs.
-- The extra guards keep a re-run from re-verifying rows that a later
-- signature transfer deliberately left unverified.
UPDATE exchange_accounts ea
SET verified_at = ea.created_at
WHERE ea.verified_at IS NULL
  AND ea.verified_nonce IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM exchange_accounts dup
    WHERE lower(dup.wallet_address) = lower(ea.wallet_address)
      AND dup.id <> ea.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM exchange_accounts claimed
    WHERE lower(claimed.wallet_address) = lower(ea.wallet_address)
      AND claimed.verified_at IS NOT NULL
  );

-- Unverified duplicates may coexist; a proven address may not.
CREATE UNIQUE INDEX IF NOT EXISTS uq_exchange_accounts_verified_wallet
  ON exchange_accounts (lower(wallet_address))
  WHERE verified_at IS NOT NULL;
