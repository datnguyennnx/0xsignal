CREATE TYPE alert_subject AS ENUM ('user', 'wallet', 'device');

CREATE TABLE alert_rules (
  id UUID PRIMARY KEY,
  subject_type alert_subject NOT NULL,
  subject_id TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  condition JSONB NOT NULL,
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  signature TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  targets TEXT[] NOT NULL DEFAULT '{inapp}',
  for_seconds INTEGER NOT NULL DEFAULT 0,
  cooldown_seconds INTEGER NOT NULL DEFAULT 600,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (subject_type, subject_id, signature)
);

CREATE INDEX idx_alert_rules_subject_enabled
  ON alert_rules (subject_type, subject_id)
  WHERE enabled;

CREATE TABLE alert_deliveries (
  id BIGSERIAL PRIMARY KEY,
  rule_id UUID NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
  bucket TEXT NOT NULL,
  fired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  UNIQUE (rule_id, bucket)
);

CREATE INDEX idx_alert_deliveries_rule_fired
  ON alert_deliveries (rule_id, fired_at DESC);

CREATE INDEX idx_alert_deliveries_fired_at
  ON alert_deliveries (fired_at);

CREATE TABLE alert_channels (
  id UUID PRIMARY KEY,
  subject_type alert_subject NOT NULL,
  subject_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  destination TEXT NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (channel, destination)
);

CREATE TABLE alert_subscriptions (
  device_id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
