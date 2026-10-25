import { Effect, Layer } from "effect";
import { PostgresConnectionPool } from "@0xsignal/auth";
import { INTENT_TTL_MS } from "./intent";
import {
  OrderIntentRepo,
  OrderIntentRepoError,
  type NewOrderIntentRecord,
  type OrderIntentClose,
  type OrderIntentRecord,
} from "./intent-repo";

const COLUMNS =
  "id, user_id, intent_hash, symbol, side, size, price, order_type, reduce_only, status, tx_hash, error, created_at";

const TTL_SECONDS = INTENT_TTL_MS / 1000;

const INSERT_SQL = `
INSERT INTO order_intents (
  user_id, intent_hash, symbol, side, size, price, order_type, time_in_force,
  reduce_only, slippage_bps, leverage, status, created_at, updated_at
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending', to_timestamp($12::bigint / 1000.0), to_timestamp($12::bigint / 1000.0))
RETURNING ${COLUMNS}`;

const FIND_SQL = `SELECT ${COLUMNS} FROM order_intents WHERE id = $1 AND user_id = $2`;

const EXPIRE_SQL = `
UPDATE order_intents
SET status = 'expired', updated_at = to_timestamp($3::bigint / 1000.0)
WHERE id = $1 AND user_id = $2 AND status = 'pending'
  AND created_at <= to_timestamp($3::bigint / 1000.0) - make_interval(secs => $4::int)
RETURNING ${COLUMNS}`;

const CLOSE_SQL = `
UPDATE order_intents
SET status = $3, tx_hash = $4, error = $5, updated_at = to_timestamp($6::bigint / 1000.0)
WHERE id = $1 AND user_id = $2 AND status = 'pending'
  AND created_at > to_timestamp($6::bigint / 1000.0) - make_interval(secs => $7::int)
RETURNING ${COLUMNS}`;

interface OrderIntentRow {
  [column: string]: unknown;
  id: string;
  user_id: string;
  intent_hash: string;
  symbol: string;
  side: "buy" | "sell";
  size: string;
  price: string | null;
  order_type: "limit" | "market";
  reduce_only: boolean;
  status: OrderIntentRecord["status"];
  tx_hash: string | null;
  error: string | null;
  created_at: Date | string;
}

const toIsoString = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : value;

const mapRow = (row: OrderIntentRow): OrderIntentRecord => ({
  id: row.id,
  userId: row.user_id,
  intentHash: row.intent_hash,
  symbol: row.symbol,
  side: row.side,
  size: row.size,
  price: row.price,
  orderType: row.order_type,
  reduceOnly: row.reduce_only,
  status: row.status,
  txHash: row.tx_hash,
  error: row.error,
  createdAt: toIsoString(row.created_at),
});

const query = (
  pool: NonNullable<import("pg").Pool>,
  sql: string,
  params: ReadonlyArray<unknown>,
): Effect.Effect<ReadonlyArray<OrderIntentRow>, OrderIntentRepoError> =>
  Effect.tryPromise({
    try: async () => (await pool.query<OrderIntentRow>(sql, [...params])).rows,
    catch: (cause) =>
      new OrderIntentRepoError({ message: "Order intent persistence failed", cause }),
  });

export const OrderIntentRepoLayer: Layer.Layer<OrderIntentRepo, never, PostgresConnectionPool> =
  Layer.effect(
    OrderIntentRepo,
    Effect.gen(function* () {
      const pool = yield* PostgresConnectionPool;
      if (pool === null) {
        return yield* Effect.die(
          new Error("PostgresConnectionPool required but was null — provide a proper pool"),
        );
      }

      return OrderIntentRepo.of({
        insert: (intent: NewOrderIntentRecord) =>
          query(pool, INSERT_SQL, [
            intent.userId,
            intent.intentHash,
            intent.symbol,
            intent.side,
            intent.size,
            intent.price,
            intent.orderType,
            intent.timeInForce,
            intent.reduceOnly,
            intent.slippageBps,
            intent.leverage,
            Date.parse(intent.createdAt),
          ]).pipe(Effect.map((rows) => mapRow(rows[0]))),

        findById: (id, userId) =>
          query(pool, FIND_SQL, [id, userId]).pipe(
            Effect.map((rows) => (rows[0] === undefined ? null : mapRow(rows[0]))),
          ),

        markExpired: (id, userId, nowMillis) =>
          query(pool, EXPIRE_SQL, [id, userId, nowMillis, TTL_SECONDS]).pipe(
            Effect.map((rows) => (rows[0] === undefined ? null : mapRow(rows[0]))),
          ),

        closePending: (id, userId, close: OrderIntentClose, nowMillis) =>
          query(pool, CLOSE_SQL, [
            id,
            userId,
            close.status,
            close.txHash,
            close.error,
            nowMillis,
            TTL_SECONDS,
          ]).pipe(Effect.map((rows) => (rows[0] === undefined ? null : mapRow(rows[0])))),
      });
    }),
  );
