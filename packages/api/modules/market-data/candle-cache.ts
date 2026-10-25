import { Context, Data, Effect, Layer } from "effect";
import type { Candle } from "@0xsignal/shared";
import { PostgresConnectionPool } from "@0xsignal/auth";
import type { MarketTimeframe } from "./timeframe";

class CandleCacheError extends Data.TaggedError("CandleCacheError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export interface CandleCachePort {
  readonly readRange: (
    symbol: string,
    timeframe: MarketTimeframe,
    startMs: number,
    endMs: number,
  ) => Effect.Effect<readonly Candle[], CandleCacheError>;

  readonly upsert: (
    symbol: string,
    timeframe: MarketTimeframe,
    candles: readonly Candle[],
  ) => Effect.Effect<void, CandleCacheError>;
}

export class CandleCache extends Context.Service<CandleCache, CandleCachePort>()("CandleCache") {}

type CandleRow = {
  readonly open_time: string;
  readonly open: string;
  readonly high: string;
  readonly low: string;
  readonly close: string;
  readonly volume: string;
};

// Bigint and numeric arrive as strings from node-postgres; convert at the edge.
const rowToCandle = (row: CandleRow): Candle => ({
  timestamp: new Date(Number(row.open_time)),
  open: Number(row.open),
  high: Number(row.high),
  low: Number(row.low),
  close: Number(row.close),
  volume: Number(row.volume),
});

const toMillis = (timestamp: Candle["timestamp"]): number => new Date(timestamp).getTime();

const READ_SQL = `
SELECT open_time, open, high, low, close, volume
FROM market_candle_cache
WHERE symbol = $1 AND interval = $2 AND open_time >= $3 AND open_time <= $4
ORDER BY open_time ASC`;

const UPSERT_SQL = (rowCount: number): string => {
  const values = Array.from(
    { length: rowCount },
    (_, row) =>
      `($${row * 8 + 1}, $${row * 8 + 2}, $${row * 8 + 3}, $${row * 8 + 4}, $${row * 8 + 5}, $${row * 8 + 6}, $${row * 8 + 7}, $${row * 8 + 8})`,
  ).join(", ");
  return `INSERT INTO market_candle_cache
    (symbol, interval, open_time, open, high, low, close, volume)
    VALUES ${values}
    ON CONFLICT (symbol, interval, open_time) DO UPDATE SET
      open = EXCLUDED.open, high = EXCLUDED.high, low = EXCLUDED.low,
      close = EXCLUDED.close, volume = EXCLUDED.volume`;
};

/** Postgres caps a statement at 65535 parameters; eight per candle keeps the batch safe. */
const UPSERT_BATCH_SIZE = 1_000;

const makePgCandleCache = (pool: NonNullable<import("pg").Pool>): CandleCachePort => {
  const readRange = (
    symbol: string,
    timeframe: MarketTimeframe,
    startMs: number,
    endMs: number,
  ): Effect.Effect<readonly Candle[], CandleCacheError> =>
    Effect.tryPromise({
      try: async () => {
        const result = await pool.query<CandleRow>(READ_SQL, [symbol, timeframe, startMs, endMs]);
        return result.rows.map(rowToCandle);
      },
      catch: (cause) => new CandleCacheError({ message: "Candle cache read failed", cause }),
    });

  const upsert = (
    symbol: string,
    timeframe: MarketTimeframe,
    candles: readonly Candle[],
  ): Effect.Effect<void, CandleCacheError> =>
    Effect.tryPromise({
      try: async () => {
        const batches: Array<readonly Candle[]> = [];
        for (let offset = 0; offset < candles.length; offset += UPSERT_BATCH_SIZE) {
          batches.push(candles.slice(offset, offset + UPSERT_BATCH_SIZE));
        }
        await Promise.all(
          batches.map((batch) => {
            const params: unknown[] = [];
            for (const candle of batch) {
              params.push(
                symbol,
                timeframe,
                toMillis(candle.timestamp),
                candle.open,
                candle.high,
                candle.low,
                candle.close,
                candle.volume,
              );
            }
            return pool.query(UPSERT_SQL(batch.length), params);
          }),
        );
      },
      catch: (cause) => new CandleCacheError({ message: "Candle cache write failed", cause }),
    });

  return { readRange, upsert };
};

const noopCache: CandleCachePort = {
  readRange: () => Effect.succeed([]),
  upsert: () => Effect.void,
};

/** Without a pool the cache is transparent: reads miss and writes are dropped. */
export const candleCacheLayer: Layer.Layer<CandleCache, never, PostgresConnectionPool> =
  Layer.effect(
    CandleCache,
    Effect.gen(function* () {
      const pool = yield* PostgresConnectionPool;
      return CandleCache.of(pool === null ? noopCache : makePgCandleCache(pool));
    }),
  );
