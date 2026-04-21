/** Candle SQL Queries for QuestDB */

import { getTimeframeMs, type MarketTimeframe } from "../../../../domain/market-data/timeframe";

export interface CandleQueryParams {
  readonly symbol: string;
  readonly exchange: string;
  readonly timeframe: MarketTimeframe;
  readonly startTime?: Date;
  readonly endTime?: Date;
  readonly limit?: number;
  readonly disableLimitForRange?: boolean;
}

const toSqlStringLiteral = (value: string): string => `'${value.replaceAll("'", "''")}'`;

const toSqlTimestampLiteral = (value: Date): string => toSqlStringLiteral(value.toISOString());

export function buildCandleSelectQuery(params: CandleQueryParams): string {
  const { symbol, exchange, timeframe, startTime, endTime, limit, disableLimitForRange } = params;

  const conditions: string[] = [
    `symbol = ${toSqlStringLiteral(symbol)}`,
    `exchange = ${toSqlStringLiteral(exchange)}`,
    `timeframe = ${toSqlStringLiteral(timeframe)}`,
  ];

  if (startTime) {
    conditions.push(`timestamp >= ${toSqlTimestampLiteral(startTime)}`);
  }
  if (endTime) {
    conditions.push(`timestamp <= ${toSqlTimestampLiteral(endTime)}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const isRangeRequest = Boolean(disableLimitForRange);
  const shouldApplyLimit = Boolean(limit && !isRangeRequest);

  if (!shouldApplyLimit) {
    return `
SELECT timestamp, open, high, low, close, volume
FROM candle
${whereClause}
ORDER BY timestamp ASC
`.trim();
  }

  return `
SELECT timestamp, open, high, low, close, volume
FROM (
  SELECT timestamp, open, high, low, close, volume
  FROM candle
  ${whereClause}
  ORDER BY timestamp DESC
  LIMIT ${limit}
) latest
ORDER BY timestamp ASC
`.trim();
}

export function buildLatestTimestampQuery(
  symbol: string,
  exchange: string,
  timeframe: MarketTimeframe
): string {
  return `
SELECT max(timestamp) as latest
FROM candle
WHERE symbol = ${toSqlStringLiteral(symbol)}
  AND exchange = ${toSqlStringLiteral(exchange)}
  AND timeframe = ${toSqlStringLiteral(timeframe)}
`.trim();
}

export function buildCoverageTimestampQuery(
  symbol: string,
  exchange: string,
  timeframe: MarketTimeframe,
  startTime: Date,
  endTime: Date
): string {
  return `
SELECT timestamp
FROM candle
WHERE symbol = ${toSqlStringLiteral(symbol)}
  AND exchange = ${toSqlStringLiteral(exchange)}
  AND timeframe = ${toSqlStringLiteral(timeframe)}
  AND timestamp >= ${toSqlTimestampLiteral(startTime)}
  AND timestamp <= ${toSqlTimestampLiteral(endTime)}
ORDER BY timestamp ASC
`.trim();
}

export function getExpectedRowCount(
  startTime: Date,
  endTime: Date,
  timeframe: MarketTimeframe
): number {
  const diff = endTime.getTime() - startTime.getTime();
  const ms = getTimeframeMs(timeframe);
  return Math.floor(diff / ms) + 1;
}
