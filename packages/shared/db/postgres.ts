import { Context } from "effect";

/**
 * PostgresConnectionPool — shared Context Tag.
 *
 * Only the Tag is declared here (no runtime `pg` dependency).
 * The actual `pg.Pool | null` implementation is provided by `packages/api`
 * via a `Layer.effect` that creates and manages the pool lifecycle.
 */
export class PostgresConnectionPool extends Context.Service<
  PostgresConnectionPool,
  import("pg").Pool | null
>()("PostgresConnectionPool") {}
