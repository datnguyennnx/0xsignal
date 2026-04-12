import { Effect, Context } from "effect";
import { QuestDBError, query, ingest, QuestDBClient, command } from "../client";
import * as queries from "../queries/candle";
import { type Candle, type CoverageResult } from "../../../../schemas/market-data";

export interface CandleQuery {
  readonly symbol: string;
  readonly exchange: string;
  readonly timeframe: queries.Timeframe;
  readonly startTime?: Date;
  readonly endTime?: Date;
  readonly limit?: number;
}

export class CandleRepository extends Context.Tag("CandleRepository")<
  CandleRepository,
  {
    readonly getCandles: (params: CandleQuery) => Effect.Effect<Candle[], QuestDBError>;
    readonly getLatestTimestamp: (
      symbol: string,
      exchange: string,
      timeframe: queries.Timeframe
    ) => Effect.Effect<Date | null, QuestDBError>;
    readonly checkCoverage: (
      symbol: string,
      exchange: string,
      timeframe: queries.Timeframe,
      startTime: Date,
      endTime: Date
    ) => Effect.Effect<CoverageResult, QuestDBError>;
    readonly insertCandles: (
      symbol: string,
      exchange: string,
      timeframe: queries.Timeframe,
      candles: Candle[]
    ) => Effect.Effect<void, QuestDBError>;
    readonly initializeSchema: () => Effect.Effect<void, QuestDBError>;
  }
>() {}

type QuestDBClientService = Context.Tag.Service<typeof QuestDBClient>;

function parseCandleRow(row: readonly unknown[]): Candle {
  return {
    timestamp: new Date(row[0] as string),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5]),
  };
}

export function getCandles(
  params: CandleQuery
): Effect.Effect<Candle[], QuestDBError, QuestDBClient> {
  return Effect.gen(function* () {
    const sql = queries.buildCandleSelectQuery(params);
    const result = yield* query(sql);

    if (!result.dataset || result.dataset.length === 0) {
      return [];
    }

    return result.dataset.map(parseCandleRow);
  });
}

export function getLatestTimestamp(
  symbol: string,
  exchange: string,
  timeframe: queries.Timeframe
): Effect.Effect<Date | null, QuestDBError, QuestDBClient> {
  return Effect.gen(function* () {
    const sql = queries.buildLatestTimestampQuery(symbol, exchange, timeframe);
    const result = yield* query(sql);

    if (!result.dataset || result.dataset.length === 0 || result.dataset[0][0] === null) {
      return null;
    }

    return new Date(result.dataset[0][0] as string);
  });
}

export function checkCoverage(
  symbol: string,
  exchange: string,
  timeframe: queries.Timeframe,
  startTime: Date,
  endTime: Date
): Effect.Effect<CoverageResult, QuestDBError, QuestDBClient> {
  return Effect.gen(function* () {
    const expectedCount = queries.getExpectedRowCount(startTime, endTime, timeframe);

    // To find gaps, we need timestamps
    const sql = `
      SELECT timestamp
      FROM candle
      WHERE symbol = '${symbol}'
        AND exchange = '${exchange}'
        AND timeframe = '${timeframe}'
        AND timestamp >= '${startTime.toISOString()}'
        AND timestamp <= '${endTime.toISOString()}'
      ORDER BY timestamp ASC
    `.trim();

    const result = yield* query(sql);
    const rowCount = result.dataset.length;

    const missingWindows: Array<{ start: Date; end: Date }> = [];
    const timeframeMs = queries.getTimeframeMs(timeframe);

    if (rowCount === 0) {
      missingWindows.push({ start: startTime, end: endTime });
    } else {
      // Check for gap at start
      const firstTs = new Date(result.dataset[0][0] as string).getTime();
      if (firstTs > startTime.getTime() + timeframeMs / 2) {
        // 1/2 timeframe tolerance
        missingWindows.push({ start: startTime, end: new Date(firstTs - timeframeMs) });
      }

      // Check intermediate gaps
      for (let i = 0; i < result.dataset.length - 1; i++) {
        const currentTs = new Date(result.dataset[i][0] as string).getTime();
        const nextTs = new Date(result.dataset[i + 1][0] as string).getTime();

        if (nextTs - currentTs > timeframeMs * 1.5) {
          missingWindows.push({
            start: new Date(currentTs + timeframeMs),
            end: new Date(nextTs - timeframeMs),
          });
        }
      }

      // Check gap at end
      const lastTs = new Date(result.dataset[rowCount - 1][0] as string).getTime();
      if (lastTs < endTime.getTime() - timeframeMs / 2) {
        missingWindows.push({ start: new Date(lastTs + timeframeMs), end: endTime });
      }
    }

    return {
      hasData: rowCount > 0,
      rowCount,
      expectedCount,
      fullCoverage: rowCount >= expectedCount,
      missingWindows,
    };
  });
}

export function insertCandles(
  symbol: string,
  exchange: string,
  timeframe: queries.Timeframe,
  candles: Candle[]
): Effect.Effect<void, QuestDBError, QuestDBClient> {
  return Effect.gen(function* () {
    if (candles.length === 0) return;

    // QuestDB ILP over HTTP expects line protocol:
    // table,tags fields timestamp
    // Tags: symbol, exchange, timeframe
    // Fields: open, high, low, close, volume (all numbers)
    // Timestamp: In nanoseconds since epoch

    // Tag values must not have spaces for simplicity in tags; quote them if they do
    // But for our symbols (BTC/USDT) it's usually safe.
    const safeSymbol = symbol.replace(/ /g, "\\ ");
    const safeExchange = exchange.replace(/ /g, "\\ ");
    const safeTimeframe = timeframe.replace(/ /g, "\\ ");

    const lines = candles.map((c) => {
      const ns = c.timestamp.getTime() * 1000000;
      return (
        `candle,symbol=${safeSymbol},exchange=${safeExchange},timeframe=${safeTimeframe} ` +
        `open=${c.open},high=${c.high},low=${c.low},close=${c.close},volume=${c.volume} ` +
        `${ns}`
      );
    });

    yield* ingest(lines);
  });
}

/**
 * Ensures the candle table exists with the correct schema.
 */
export function initializeSchema(): Effect.Effect<void, QuestDBError, QuestDBClient> {
  const sql = `
    CREATE TABLE IF NOT EXISTS candle (
      symbol SYMBOL,
      exchange SYMBOL,
      timeframe SYMBOL,
      open DOUBLE,
      high DOUBLE,
      low DOUBLE,
      close DOUBLE,
      volume DOUBLE,
      timestamp TIMESTAMP
    ) timestamp(timestamp) PARTITION BY DAY WAL;
  `.trim();

  return command(sql);
}

export const CandleRepositoryLive = (client: QuestDBClientService) =>
  CandleRepository.of({
    getCandles: (params) => getCandles(params).pipe(Effect.provideService(QuestDBClient, client)),
    getLatestTimestamp: (symbol, exchange, timeframe) =>
      getLatestTimestamp(symbol, exchange, timeframe).pipe(
        Effect.provideService(QuestDBClient, client)
      ),
    checkCoverage: (symbol, exchange, timeframe, startTime, endTime) =>
      checkCoverage(symbol, exchange, timeframe, startTime, endTime).pipe(
        Effect.provideService(QuestDBClient, client)
      ),
    insertCandles: (symbol, exchange, timeframe, candles) =>
      insertCandles(symbol, exchange, timeframe, candles).pipe(
        Effect.provideService(QuestDBClient, client)
      ),
    initializeSchema: () => initializeSchema().pipe(Effect.provideService(QuestDBClient, client)),
  });

// Also provide a Layer for the Repository
import { Layer } from "effect";
export const CandleRepositoryLayer = Layer.effect(
  CandleRepository,
  Effect.gen(function* () {
    const client = yield* QuestDBClient;
    return CandleRepositoryLive(client);
  })
);
