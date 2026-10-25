-- The credential stack was removed in 008; nothing writes or reads this table
-- and its credential_id no longer references a live table.
DROP TABLE IF EXISTS credential_audit_log;
