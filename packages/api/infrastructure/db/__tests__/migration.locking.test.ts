import { beforeEach, describe, expect, it, vi } from "vitest";

const clientQuery = vi.fn();
const clientRelease = vi.fn();
const poolQuery = vi.fn();

vi.mock("../postgres/client", () => ({
  getClient: vi.fn(async () => ({ query: clientQuery, release: clientRelease })),
  query: poolQuery,
}));

describe("Migration locking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clientQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("pg_try_advisory_lock")) {
        return { rows: [{ acquired: true }] };
      }
      if (sql.includes("schema_migrations")) {
        return { rows: [] };
      }
      return { rows: [] };
    });
  });

  it("releases advisory lock on the same client", async () => {
    const { runMigrations } = await import("../postgres/migrations/migration");

    await runMigrations();

    expect(clientQuery).toHaveBeenCalledWith(
      "SELECT pg_try_advisory_lock($1) as acquired",
      [1234567890]
    );
    expect(clientQuery).toHaveBeenCalledWith("SELECT pg_advisory_unlock($1)", [1234567890]);
    expect(clientRelease).toHaveBeenCalledTimes(1);
    expect(poolQuery).not.toHaveBeenCalledWith("SELECT pg_advisory_unlock($1)", [1234567890]);
  });
});
