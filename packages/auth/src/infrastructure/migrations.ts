import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql/SqlClient";
import * as PgMigrator from "@effect/sql-pg/PgMigrator";

export const migrations = PgMigrator.fromRecord({
  "001_init": Effect.gen(function* () {
    const sql = yield* SqlClient;

    yield* sql.unsafe(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

    yield* sql.unsafe(`CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'banned')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);

    yield* sql.unsafe(`CREATE TABLE IF NOT EXISTS oauth_accounts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL CHECK (provider IN ('google', 'github')),
      provider_user_id TEXT NOT NULL,
      email TEXT,
      display_name TEXT,
      avatar_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (provider, provider_user_id)
    )`);

    yield* sql.unsafe(
      `CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user_id ON oauth_accounts(user_id)`
    );
    yield* sql.unsafe(
      `CREATE INDEX IF NOT EXISTS idx_oauth_accounts_lookup ON oauth_accounts(provider, provider_user_id)`
    );

    yield* sql.unsafe(`CREATE TABLE IF NOT EXISTS oauth_states (
      state TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      redirect_url TEXT,
      code_verifier TEXT,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    yield* sql.unsafe(
      `CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON oauth_states(expires_at)`
    );

    yield* sql.unsafe(`CREATE TABLE IF NOT EXISTS auth_codes (
      code TEXT PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL CHECK (provider IN ('google', 'github')),
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    yield* sql.unsafe(
      `CREATE INDEX IF NOT EXISTS idx_auth_codes_expires ON auth_codes(expires_at)`
    );

    yield* sql.unsafe(`CREATE TABLE IF NOT EXISTS refresh_token_blocklist (
      jti TEXT PRIMARY KEY,
      expires_at TIMESTAMPTZ NOT NULL
    )`);
    yield* sql.unsafe(
      `CREATE INDEX IF NOT EXISTS idx_blocklist_expires ON refresh_token_blocklist(expires_at)`
    );

    yield* sql.unsafe(`CREATE OR REPLACE FUNCTION set_updated_at()
      RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql`);

    yield* sql.unsafe(`DROP TRIGGER IF EXISTS users_updated_at ON users`);
    yield* sql.unsafe(`CREATE TRIGGER users_updated_at
      BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at()`);

    yield* sql.unsafe(`DROP TRIGGER IF EXISTS oauth_accounts_updated_at ON oauth_accounts`);
    yield* sql.unsafe(`CREATE TRIGGER oauth_accounts_updated_at
      BEFORE UPDATE ON oauth_accounts FOR EACH ROW EXECUTE FUNCTION set_updated_at()`);
  }),
});
