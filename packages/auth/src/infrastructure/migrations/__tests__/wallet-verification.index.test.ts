import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { describe, expect, it } from "vitest";

const databaseUrl = process.env.MIGRATION_TEST_DATABASE_URL ?? "";
const databaseName = databaseUrl === "" ? "" : new URL(databaseUrl).pathname.slice(1);
const migrationFile = new URL(
  "../sql/014_exchange_account_wallet_verification.up.sql",
  import.meta.url,
);

const UNIQUE_ADDRESS = `0x${"a".repeat(40)}`;
const SHARED_ADDRESS = `0x${"b".repeat(40)}`;

const hasCode = (error: unknown, code: string): boolean =>
  typeof error === "object" && error !== null && "code" in error && error.code === code;

type VerificationRow = { readonly id: string; readonly verified_at: Date | null };
type IndexRow = { readonly indexname: string };

// Runs only against a scratch database, mirroring the migration-runner suite.
describe.skipIf(!databaseName.endsWith("_probe"))("wallet verification migration", () => {
  it("backfills only unambiguous addresses and rejects a second verified row", async () => {
    const schema = "wallet_verify_probe";
    const pool = new Pool({
      connectionString: databaseUrl,
      options: `-c search_path=${schema}`,
    });
    const admin = new Pool({ connectionString: databaseUrl });
    const migration = await readFile(migrationFile, "utf8");

    try {
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.query(`CREATE SCHEMA ${schema}`);
      await pool.query(`CREATE TABLE exchange_accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        wallet_address TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
      await pool.query(
        `INSERT INTO exchange_accounts (wallet_address, created_at) VALUES
         ($1, '2026-01-01T00:00:00Z'),
         ($2, '2026-01-02T00:00:00Z'),
         ($2, '2026-01-03T00:00:00Z')`,
        [UNIQUE_ADDRESS, SHARED_ADDRESS],
      );

      await pool.query(migration);

      const count = await pool.query<{ readonly cnt: number }>(
        "SELECT COUNT(*)::int AS cnt FROM exchange_accounts",
      );
      expect(count.rows[0]?.cnt).toBe(3);

      const unique = await pool.query<VerificationRow>(
        "SELECT id, verified_at FROM exchange_accounts WHERE wallet_address = $1",
        [UNIQUE_ADDRESS],
      );
      expect(unique.rows[0]?.verified_at).not.toBeNull();

      const shared = await pool.query<VerificationRow>(
        "SELECT id, verified_at FROM exchange_accounts WHERE wallet_address = $1 ORDER BY created_at",
        [SHARED_ADDRESS],
      );
      expect(shared.rows).toHaveLength(2);
      expect(shared.rows.every((row) => row.verified_at === null)).toBe(true);

      const index = await pool.query<IndexRow>(
        "SELECT indexname FROM pg_indexes WHERE schemaname = $1 AND indexname = $2",
        [schema, "uq_exchange_accounts_verified_wallet"],
      );
      expect(index.rows).toHaveLength(1);

      const ids = shared.rows.map((row) => row.id);
      const results = await Promise.allSettled([
        pool.query("UPDATE exchange_accounts SET verified_at = NOW() WHERE id = $1", [ids[0]]),
        pool.query("UPDATE exchange_accounts SET verified_at = NOW() WHERE id = $1", [ids[1]]),
      ]);

      const fulfilled = results.filter((result) => result.status === "fulfilled");
      const rejected = results.filter(
        (result): result is PromiseRejectedResult => result.status === "rejected",
      );
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(hasCode(rejected[0]?.reason, "23505")).toBe(true);

      const verified = await pool.query<{ readonly cnt: number }>(
        "SELECT COUNT(*)::int AS cnt FROM exchange_accounts WHERE verified_at IS NOT NULL AND wallet_address = $1",
        [SHARED_ADDRESS],
      );
      expect(verified.rows[0]?.cnt).toBe(1);
    } finally {
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await pool.end();
      await admin.end();
    }
  });
});
