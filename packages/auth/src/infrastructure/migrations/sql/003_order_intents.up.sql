-- Depends on 001_init

-- Unsigned order intents: the backend validates and records what the browser
-- is about to sign, without ever holding a key.
CREATE TABLE IF NOT EXISTS order_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  intent_hash TEXT NOT NULL,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
  size TEXT NOT NULL,
  price TEXT,
  order_type TEXT NOT NULL CHECK (order_type IN ('limit', 'market')),
  time_in_force TEXT,
  reduce_only BOOLEAN NOT NULL DEFAULT false,
  slippage_bps INTEGER,
  leverage NUMERIC,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'rejected', 'expired')),
  tx_hash TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_order_intent_outcome CHECK (
    (status = 'submitted' AND tx_hash IS NOT NULL) OR
    (status = 'rejected' AND error IS NOT NULL) OR
    status IN ('pending', 'expired')
  )
);
