CREATE TABLE alert_link_codes (
  code TEXT PRIMARY KEY,
  subject_type alert_subject NOT NULL,
  subject_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_alert_link_codes_expires_at
  ON alert_link_codes (expires_at);

ALTER TABLE alert_channels
  ADD COLUMN IF NOT EXISTS label TEXT,
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS last_sent_at TIMESTAMPTZ;
