-- A duplicate submission is detectable by looking up the same canonical hash.
CREATE INDEX IF NOT EXISTS idx_order_intents_user_hash
  ON order_intents (user_id, intent_hash);
