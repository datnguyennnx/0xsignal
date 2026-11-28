CREATE TABLE alert_read_state (
  subject_type alert_subject NOT NULL,
  subject_id TEXT NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (subject_type, subject_id)
);
