import { Data, Effect } from "effect";
import { PostgresConnectionPool } from "@0xsignal/auth";

export class WhaleSchemaError extends Data.TaggedError("WhaleSchemaError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

// Each entry is executed as its own statement so one failure (e.g. a
// constraint that already exists under a different name) cannot abort the
// rest of the reconciliation. Every statement is idempotent and additive;
// nothing is dropped.
const SCHEMA_STATEMENTS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS whale_positions (
    user_address text NOT NULL,
    coin text NOT NULL,
    side text NOT NULL,
    size numeric NOT NULL,
    notional_usd numeric NOT NULL,
    entry_px numeric NOT NULL,
    liquidation_px numeric,
    leverage int,
    leverage_type text,
    margin_usd numeric,
    unrealized_pnl numeric NOT NULL,
    unrealized_pnl_pct numeric NOT NULL,
    funding_fee numeric,
    mark_price numeric,
    entry_time timestamptz,
    updated_at timestamptz DEFAULT now(),
    PRIMARY KEY (user_address, coin)
  )`,

  `CREATE INDEX IF NOT EXISTS whale_positions_notional_usd_idx
    ON whale_positions (notional_usd DESC)`,

  `CREATE INDEX IF NOT EXISTS whale_positions_coin_idx
    ON whale_positions (coin)`,

  `CREATE INDEX IF NOT EXISTS whale_positions_side_idx
    ON whale_positions (side)`,

  `ALTER TABLE whale_positions
    ADD COLUMN IF NOT EXISTS user_address text,
    ADD COLUMN IF NOT EXISTS coin text,
    ADD COLUMN IF NOT EXISTS side text,
    ADD COLUMN IF NOT EXISTS size numeric,
    ADD COLUMN IF NOT EXISTS notional_usd numeric,
    ADD COLUMN IF NOT EXISTS entry_px numeric,
    ADD COLUMN IF NOT EXISTS liquidation_px numeric,
    ADD COLUMN IF NOT EXISTS leverage int,
    ADD COLUMN IF NOT EXISTS leverage_type text,
    ADD COLUMN IF NOT EXISTS margin_usd numeric,
    ADD COLUMN IF NOT EXISTS unrealized_pnl numeric,
    ADD COLUMN IF NOT EXISTS unrealized_pnl_pct numeric,
    ADD COLUMN IF NOT EXISTS funding_fee numeric,
    ADD COLUMN IF NOT EXISTS mark_price numeric,
    ADD COLUMN IF NOT EXISTS entry_time timestamptz,
    ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now()`,

  `ALTER TABLE whale_positions
    ALTER COLUMN liquidation_px DROP NOT NULL,
    ALTER COLUMN leverage DROP NOT NULL,
    ALTER COLUMN margin_usd DROP NOT NULL,
    ALTER COLUMN funding_fee DROP NOT NULL,
    ALTER COLUMN mark_price DROP NOT NULL,
    ALTER COLUMN entry_time DROP NOT NULL,
    ALTER COLUMN updated_at DROP NOT NULL`,
];

export const ensureWhaleSchema: Effect.Effect<void, WhaleSchemaError, PostgresConnectionPool> =
  Effect.gen(function* () {
    const pool = yield* PostgresConnectionPool;
    if (pool === null) {
      yield* Effect.fail(
        new WhaleSchemaError({ message: "PostgresConnectionPool is not configured" }),
      );
      return;
    }
    for (const [index, statement] of SCHEMA_STATEMENTS.entries()) {
      yield* Effect.tryPromise({
        try: async () => {
          await pool.query(statement);
        },
        catch: (cause) =>
          new WhaleSchemaError({ message: "Failed to initialize whale schema", cause }),
      }).pipe(
        Effect.catch((error) =>
          Effect.logWarning(
            `[whale] schema statement ${index + 1}/${SCHEMA_STATEMENTS.length} failed, continuing: ${error.message}`,
          ),
        ),
      );
    }
  });
