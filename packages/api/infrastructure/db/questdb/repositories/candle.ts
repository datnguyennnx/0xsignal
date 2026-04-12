/** Candlestick Repository - QuestDB OHLCV data access */

import { Effect } from "effect";
import { QuestDBError, exec } from "../client";
import * as queries from "../queries/candle";

export interface Candle {
  readonly timestamp: Date;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume: number;
}

export interface CandleQuery {
  readonly symbol: string;
  readonly exchange: string;
  readonly timeframe: queries.Timeframe;
  readonly startTime?: Date;
  readonly endTime?: Date;
  readonly limit?: number;
}

export interface CoverageResult {
  readonly hasData: boolean;
  readonly rowCount: number;
}

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

export function getCandles(query: CandleQuery): Effect.Effect<Candle[], QuestDBError> {
  return Effect.gen(function* () {
    const sql = queries.buildCandleSelectQuery(query);
    const result = yield* exec(sql);

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
): Effect.Effect<Date | null, QuestDBError> {
  return Effect.gen(function* () {
    const sql = queries.buildLatestTimestampQuery(symbol, exchange, timeframe);
    const result = yield* exec(sql);

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
): Effect.Effect<CoverageResult, QuestDBError> {
  return Effect.gen(function* () {
    const sql = queries.buildCoverageQuery(symbol, exchange, timeframe, startTime, endTime);
    const result = yield* exec(sql);

    const rowCount = Number(result.dataset[0]?.[0] ?? 0);

    return {
      hasData: rowCount > 0,
      rowCount,
    };
  });
}
