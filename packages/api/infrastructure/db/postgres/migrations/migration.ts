import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getClient, query, type PoolClient } from "../client";

const MIGRATION_FILES = [
  "001_agent_core.sql",
  "002_strategy_core.sql",
  "003_market_data.sql",
  "004_backtest_core.sql",
  "005_research_core.sql",
  "006_mcp_core.sql",
  "007_integrity_hardening.sql",
];

const SCHEMA_MIGRATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL UNIQUE,
    direction VARCHAR(10) NOT NULL DEFAULT 'up',
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`;

const ADVISORY_LOCK_ID = 1234567890;

interface MigrationData {
  filename: string;
  up: string[];
  down: string[];
}

function extractMigrationSections(content: string): { up: string[]; down: string[] } {
  const lines = content.split("\n");
  let currentSection: "header" | "up" | "down" = "header";
  const upStatements: string[] = [];
  const downStatements: string[] = [];
  let currentStatement = "";

  for (const line of lines) {
    const trimmed = line.trim().toUpperCase();

    if (trimmed === "-- UP:") {
      currentSection = "up";
      continue;
    }
    if (trimmed === "-- DOWN:") {
      if (currentStatement.trim()) {
        if (currentSection === "up") upStatements.push(currentStatement);
        else if (currentSection === "down") downStatements.push(currentStatement);
      }
      currentSection = "down";
      currentStatement = "";
      continue;
    }

    if (
      trimmed.startsWith("--") ||
      trimmed.startsWith("MIGRATION:") ||
      trimmed.startsWith("DESCRIPTION:")
    ) {
      continue;
    }

    currentStatement += line + "\n";

    if (line.includes(";") && !line.trim().startsWith("--")) {
      const trimmedStmt = currentStatement.trim();
      if (trimmedStmt) {
        if (currentSection === "up") upStatements.push(trimmedStmt);
        else if (currentSection === "down") downStatements.push(trimmedStmt);
      }
      currentStatement = "";
    }
  }

  if (currentStatement.trim()) {
    if (currentSection === "up") upStatements.push(currentStatement.trim());
    else if (currentSection === "down") downStatements.push(currentStatement.trim());
  }

  return { up: upStatements, down: downStatements };
}

async function ensureMigrationsTable(client: PoolClient): Promise<void> {
  await client.query(SCHEMA_MIGRATIONS_TABLE);
}

async function isMigrationApplied(
  client: PoolClient,
  filename: string,
  direction: string
): Promise<boolean> {
  const result = await client.query(
    "SELECT 1 FROM schema_migrations WHERE filename = $1 AND direction = $2",
    [filename, direction]
  );
  return result.rows.length > 0;
}

async function getMigrationData(filepath: string, filename: string): Promise<MigrationData> {
  const content = await readFile(filepath, "utf-8");
  const sections = extractMigrationSections(content);
  return {
    filename,
    up: sections.up,
    down: sections.down,
  };
}

async function runUpMigration(client: PoolClient, migration: MigrationData): Promise<boolean> {
  if (await isMigrationApplied(client, migration.filename, "up")) {
    console.log(`Skipped: ${migration.filename} (already applied)`);
    return false;
  }

  for (const stmt of migration.up) {
    if (stmt.trim()) {
      await client.query(stmt);
    }
  }

  await client.query("INSERT INTO schema_migrations (filename, direction) VALUES ($1, 'up')", [
    migration.filename,
  ]);
  console.log(`Executed UP: ${migration.filename}`);
  return true;
}

async function runDownMigration(client: PoolClient, migration: MigrationData): Promise<boolean> {
  if (!(await isMigrationApplied(client, migration.filename, "up"))) {
    console.log(`Skipped: ${migration.filename} (not applied)`);
    return false;
  }

  for (const stmt of migration.down) {
    if (stmt.trim()) {
      await client.query(stmt);
    }
  }

  await client.query("DELETE FROM schema_migrations WHERE filename = $1 AND direction = 'up'", [
    migration.filename,
  ]);
  console.log(`Executed DOWN: ${migration.filename}`);
  return true;
}

export async function runMigrations(direction: "up" | "down" = "up"): Promise<void> {
  let client: PoolClient | null = null;

  try {
    console.log(`Running ${direction} migrations...`);
    client = await getClient();
    await client.query("BEGIN");

    const lockResult = await client.query("SELECT pg_try_advisory_lock($1) as acquired", [
      ADVISORY_LOCK_ID,
    ]);

    if (!lockResult.rows[0]?.acquired) {
      throw new Error("Could not acquire advisory lock");
    }

    await ensureMigrationsTable(client);

    const files = direction === "up" ? MIGRATION_FILES : [...MIGRATION_FILES].reverse();

    for (const filename of files) {
      const filepath = join(__dirname, filename);
      const migration = await getMigrationData(filepath, filename);

      if (direction === "up") {
        await runUpMigration(client, migration);
      } else {
        await runDownMigration(client, migration);
      }
    }

    await client.query("COMMIT");
    console.log(`All ${direction} migrations completed`);
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK").catch(() => {});
    }
    throw error;
  } finally {
    if (client) {
      await client.query("SELECT pg_advisory_unlock($1)", [ADVISORY_LOCK_ID]).catch(() => {});
      client.release();
    }
  }
}

export async function rollbackMigration(filename: string): Promise<void> {
  let client: PoolClient | null = null;

  try {
    client = await getClient();
    await client.query("BEGIN");

    const lockResult = await client.query("SELECT pg_try_advisory_lock($1) as acquired", [
      ADVISORY_LOCK_ID,
    ]);

    if (!lockResult.rows[0]?.acquired) {
      throw new Error("Could not acquire advisory lock");
    }

    const filepath = join(__dirname, filename);
    const migration = await getMigrationData(filepath, filename);

    await runDownMigration(client, migration);

    await client.query("COMMIT");
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK").catch(() => {});
    }
    throw error;
  } finally {
    if (client) {
      await client.query("SELECT pg_advisory_unlock($1)", [ADVISORY_LOCK_ID]).catch(() => {});
      client.release();
    }
  }
}

export async function getMigrationStatus(): Promise<
  Array<{ filename: string; applied: boolean; executedAt: string | null }>
> {
  const result = await query("SELECT filename, executed_at FROM schema_migrations ORDER BY id");

  return MIGRATION_FILES.map((filename) => {
    const applied = result.rows.find((r) => r.filename === filename);
    return {
      filename,
      applied: !!applied,
      executedAt: applied?.executed_at ?? null,
    };
  });
}
