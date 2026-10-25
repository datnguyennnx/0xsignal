CREATE INDEX IF NOT EXISTS idx_order_intents_user_created
  ON order_intents (user_id, created_at DESC);
