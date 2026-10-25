CREATE TABLE rollback_probe (
  id INTEGER PRIMARY KEY
);

INSERT INTO rollback_probe (id) VALUES (1);

INSERT INTO missing_table (id) VALUES (1);
