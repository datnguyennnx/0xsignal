import pg, { Pool, QueryResult, type PoolClient } from "pg";

const { Pool: PostgresPool } = pg;

export type { PoolClient };

export interface PostgresConnectionConfig {
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?: boolean | { rejectUnauthorized: boolean };
  connectionString?: string;
  max?: number;
  idleTimeoutMillis?: number;
  connectTimeoutMillis?: number;
}

function getPostgresConfig(): PostgresConnectionConfig {
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

  if (connectionString) {
    return { connectionString };
  }

  return {
    host: process.env.POSTGRES_HOST || "localhost",
    port: parseInt(process.env.POSTGRES_PORT || "5432", 10),
    database: process.env.POSTGRES_DB || "0xsignal",
    user: process.env.POSTGRES_USER || "postgres",
    password: process.env.POSTGRES_PASSWORD || "postgres",
    ssl: process.env.POSTGRES_SSL === "true" ? { rejectUnauthorized: false } : false,
    max: parseInt(process.env.POSTGRES_POOL_MAX || "10", 10),
    idleTimeoutMillis: 30000,
    connectTimeoutMillis: 10000,
  };
}

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new PostgresPool(getPostgresConfig());
    pool.on("error", (err: Error) => {
      console.error("Unexpected PostgreSQL pool error:", err);
    });
  }
  return pool;
}

export async function query(sql: string, params?: unknown[]): Promise<QueryResult> {
  const pool = getPool();
  return pool.query(sql, params);
}

export async function getClient(): Promise<PoolClient> {
  const pool = getPool();
  return pool.connect();
}

export async function healthCheck(): Promise<boolean> {
  try {
    const result = await query("SELECT 1 as health");
    return result.rows[0]?.health === 1;
  } catch {
    return false;
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
