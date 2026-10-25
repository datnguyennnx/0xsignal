-- One file, several statements: a naive split on ";" would break the trigger
-- body below, which is why the runner sends the whole file as one statement.
CREATE TABLE multi_probe (
  id INTEGER PRIMARY KEY,
  label TEXT NOT NULL
);

CREATE INDEX idx_multi_probe_label ON multi_probe (label);

INSERT INTO multi_probe (id, label) VALUES (1, 'first'), (2, 'second');

CREATE FUNCTION multi_probe_touch() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.label := NEW.label;
  RETURN NEW;
END;
$$;

CREATE TRIGGER multi_probe_touch
  BEFORE UPDATE ON multi_probe
  FOR EACH ROW EXECUTE FUNCTION multi_probe_touch();
