import { Effect, Context, Layer } from "effect";

export interface ChartDataPoint {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ChartDataService {
  readonly getHistoricalData: (
    symbol: string,
    interval: string,
    limit: number
  ) => Effect.Effect<ChartDataPoint[], Error>;
}

export class ChartDataServiceTag extends Context.Tag("ChartDataService")<
  ChartDataServiceTag,
  ChartDataService
>() {}

// Binance interval mapping
const INTERVAL_MAP: Record<string, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "30m": "30m",
  "1h": "1h",
  "4h": "4h",
  "1d": "1d",
  "1w": "1w",
};

// Calculate limit based on timeframe
const calculateLimit = (timeframe: string, interval: string): number => {
  const limits: Record<string, Record<string, number>> = {
    "24h": { "1m": 1440, "5m": 288, "15m": 96, "30m": 48, "1h": 24 },
    "7d": { "15m": 672, "30m": 336, "1h": 168, "4h": 42 },
    "1M": { "1h": 720, "4h": 180, "1d": 30 },
    "1y": { "1d": 365, "1w": 52 },
  };

  return limits[timeframe]?.[interval] || 100;
};

const getHistoricalData = (
  symbol: string,
  interval: string,
  limit: number
): Effect.Effect<ChartDataPoint[], Error> =>
  Effect.tryPromise({
    try: async () => {
      const binanceInterval = INTERVAL_MAP[interval] || "1h";
      const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${binanceInterval}&limit=${limit}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Binance API error: ${response.statusText}`);
      }

      const data = (await response.json()) as any[];

      return data.map(
        (k): ChartDataPoint => ({
          time: Math.floor(k[0] / 1000), // Convert to seconds
          open: parseFloat(k[1]),
          high: parseFloat(k[2]),
          low: parseFloat(k[3]),
          close: parseFloat(k[4]),
          volume: parseFloat(k[5]),
        })
      );
    },
    catch: (error) => new Error(`Failed to fetch chart data: ${error}`),
  });

export const ChartDataServiceLive = Layer.succeed(ChartDataServiceTag, {
  getHistoricalData,
});
