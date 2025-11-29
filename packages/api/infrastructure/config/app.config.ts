/** Application Configuration - Type-safe config using Effect Config */

import { Config, Context, Duration, Effect, Layer } from "effect";

// Environment config
export const EnvConfig = Config.all({
  coingeckoApiKey: Config.string("COINGECKO_API_KEY").pipe(Config.withDefault("")),
  port: Config.number("PORT").pipe(Config.withDefault(9006)),
  logLevel: Config.string("LOG_LEVEL").pipe(Config.withDefault("info")),
  enablePrewarm: Config.boolean("ENABLE_PREWARM").pipe(Config.withDefault(true)),
});

export type EnvConfig = Config.Config.Success<typeof EnvConfig>;

// App config service
export interface AppConfig {
  readonly env: EnvConfig;
  readonly api: typeof API_URLS;
  readonly cache: typeof CACHE_TTL;
  readonly limits: typeof DEFAULT_LIMITS;
  readonly ws: typeof WS_CONFIG;
}

export class AppConfigTag extends Context.Tag("AppConfig")<AppConfigTag, AppConfig>() {}

export const AppConfigLive = Layer.effect(
  AppConfigTag,
  Effect.gen(function* () {
    const env = yield* EnvConfig;
    return { env, api: API_URLS, cache: CACHE_TTL, limits: DEFAULT_LIMITS, ws: WS_CONFIG };
  })
);

// API URLs
export const API_URLS = {
  COINGECKO: "https://api.coingecko.com/api/v3",
  BINANCE: "https://api.binance.com/api/v3",
  BINANCE_FUTURES: "https://fapi.binance.com/fapi/v1",
  DEFILLAMA: "https://api.llama.fi",
} as const;

// Cache TTL
export const CACHE_TTL = {
  COINGECKO_PRICE: Duration.minutes(5),
  COINGECKO_TOP_CRYPTOS: Duration.minutes(5),
  BINANCE_EXCHANGE_INFO: Duration.minutes(10),
  BINANCE_OPEN_INTEREST: Duration.minutes(2),
  BINANCE_FUNDING_RATE: Duration.minutes(5),
  BINANCE_LIQUIDATIONS: Duration.minutes(2),
  BINANCE_CHART: Duration.minutes(1),
  DEFILLAMA_PROTOCOLS: Duration.minutes(15),
  DEFILLAMA_PROTOCOL: Duration.minutes(10),
  HEATMAP: Duration.minutes(5),
  ANALYSIS: Duration.minutes(5),
  BUYBACK_SIGNALS: Duration.minutes(10),
  BUYBACK_OVERVIEW: Duration.minutes(10),
  BUYBACK_PROTOCOL: Duration.minutes(10),
} as const;

// Cache capacity
export const CACHE_CAPACITY = {
  DEFAULT: 100,
  LARGE: 200,
  SMALL: 20,
  SINGLE: 10,
} as const;

// Rate limits
export const RATE_LIMITS = {
  COINGECKO: 30,
  BINANCE: 1200,
  DEFILLAMA: 60,
} as const;

// Default limits
export const DEFAULT_LIMITS = {
  TOP_CRYPTOS: 100,
  TOP_CRYPTOS_EXTENDED: 250,
  ANALYSIS_ASSETS: 100,
  BUYBACK_SIGNALS: 50,
  OPEN_INTEREST: 20,
  HEATMAP: 100,
  MAX_HEATMAP: 200,
} as const;

// WebSocket config
export const WS_CONFIG = {
  BINANCE_URL: "wss://stream.binance.com:9443/ws",
  RECONNECT_DELAY_MS: 5000,
  MAX_RECONNECT_ATTEMPTS: 10,
  PING_INTERVAL_MS: 30000,
  PONG_TIMEOUT_MS: 10000,
  CLEANUP_INTERVAL: Duration.minutes(1),
} as const;

// Binance intervals
export const BINANCE_INTERVALS: Record<string, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "30m": "30m",
  "1h": "1h",
  "4h": "4h",
  "1d": "1d",
  "1w": "1w",
};

// Timeframe limits
export const TIMEFRAME_LIMITS: Record<string, Record<string, number>> = {
  "24h": { "1m": 1440, "5m": 288, "15m": 96, "30m": 48, "1h": 24 },
  "7d": { "15m": 672, "30m": 336, "1h": 168, "4h": 42 },
  "1M": { "1h": 720, "4h": 180, "1d": 30 },
  "1y": { "1d": 365, "1w": 52 },
};
