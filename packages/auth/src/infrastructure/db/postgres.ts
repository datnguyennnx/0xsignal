import { Context } from "effect";

/**
 * PostgresConnectionPool — Context Tag for the database connection pool.
 *
 * Moved from `@0xsignal/shared/db/postgres` to this package because Effect
 * runtime code must not live in `@0xsignal/shared` (which is zero-dependency).
 * `packages/api` consumes this tag via `@0xsignal/auth`.
 *
 * The actual `pg.Pool | null` implementation is provided by `packages/api`
 * via a `Layer.effect` that creates and manages the pool lifecycle.
 */
export class PostgresConnectionPool extends Context.Service<
  PostgresConnectionPool,
  import("pg").Pool | null
>()("PostgresConnectionPool") {}
