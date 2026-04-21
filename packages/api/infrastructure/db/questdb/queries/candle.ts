/** Candle SQL Queries for QuestDB */

export type Timeframe =
  | "1m"
  | "3m"
  | "5m"
  | "15m"
  | "30m"
  | "1h"
  | "2h"
  | "4h"
  | "8h"
  | "12h"
  | "1d"
  | "1w";

export interface CandleQueryParams {
  readonly symbol: string;
  readonly exchange: string;
  readonly timeframe: Timeframe;
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
  timeframe: Timeframe
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
  timeframe: Timeframe,
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

export function getTimeframeMs(timeframe: Timeframe): number {
  switch (timeframe) {
    case "1m":
      return 60 * 1000;
    case "5m":
      return 5 * 60 * 1000;
    case "3m":
      return 3 * 60 * 1000;
    case "15m":
      return 15 * 60 * 1000;
    case "30m":
      return 30 * 60 * 1000;
    case "1h":
      return 60 * 60 * 1000;
    case "2h":
      return 2 * 60 * 60 * 1000;
    case "4h":
      return 4 * 60 * 60 * 1000;
    case "8h":
      return 8 * 60 * 60 * 1000;
    case "12h":
      return 12 * 60 * 60 * 1000;
    case "1d":
      return 24 * 60 * 60 * 1000;
    case "1w":
      return 7 * 24 * 60 * 60 * 1000;
    default:
      return 60 * 1000;
  }
}

export function getExpectedRowCount(startTime: Date, endTime: Date, timeframe: Timeframe): number {
  const diff = endTime.getTime() - startTime.getTime();
  const ms = getTimeframeMs(timeframe);
  return Math.floor(diff / ms) + 1;
}
