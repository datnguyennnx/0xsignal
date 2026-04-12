/** Candle SQL Queries for QuestDB */

export type Timeframe = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

export interface CandleQueryParams {
  readonly symbol: string;
  readonly exchange: string;
  readonly timeframe: Timeframe;
  readonly startTime?: Date;
  readonly endTime?: Date;
  readonly limit?: number;
}

export function buildCandleSelectQuery(params: CandleQueryParams): string {
  const { symbol, exchange, timeframe, startTime, endTime, limit = 1000 } = params;

  const conditions: string[] = [
    `symbol = '${symbol}'`,
    `exchange = '${exchange}'`,
    `timeframe = '${timeframe}'`,
  ];

  if (startTime) {
    conditions.push(`timestamp >= '${startTime.toISOString()}'`);
  }
  if (endTime) {
    conditions.push(`timestamp <= '${endTime.toISOString()}'`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  return `
SELECT timestamp, open, high, low, close, volume
FROM candle
${whereClause}
ORDER BY timestamp ASC
LIMIT ${limit}
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
WHERE symbol = '${symbol}'
  AND exchange = '${exchange}'
  AND timeframe = '${timeframe}'
`.trim();
}

export function buildCoverageQuery(
  symbol: string,
  exchange: string,
  timeframe: Timeframe,
  startTime: Date,
  endTime: Date
): string {
  return `
SELECT count(*) as count
FROM candle
WHERE symbol = '${symbol}'
  AND exchange = '${exchange}'
  AND timeframe = '${timeframe}'
  AND timestamp >= '${startTime.toISOString()}'
  AND timestamp <= '${endTime.toISOString()}'
`.trim();
}

export function buildCountQuery(symbol: string, exchange: string, timeframe: Timeframe): string {
  return `
SELECT count(*) as count
FROM candle
WHERE symbol = '${symbol}'
  AND exchange = '${exchange}'
  AND timeframe = '${timeframe}'
`.trim();
}
export function getTimeframeMs(timeframe: Timeframe): number {
  switch (timeframe) {
    case "1m":
      return 60 * 1000;
    case "5m":
      return 5 * 60 * 1000;
    case "15m":
      return 15 * 60 * 1000;
    case "1h":
      return 60 * 60 * 1000;
    case "4h":
      return 4 * 60 * 60 * 1000;
    case "1d":
      return 24 * 60 * 60 * 1000;
    default:
      return 60 * 1000;
  }
}

export function getExpectedRowCount(startTime: Date, endTime: Date, timeframe: Timeframe): number {
  const diff = endTime.getTime() - startTime.getTime();
  const ms = getTimeframeMs(timeframe);
  return Math.floor(diff / ms) + 1;
}
