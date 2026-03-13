/** Application Configuration - Type-safe config using Effect Config */

import { Config, Context, Duration, Effect, Layer, Option, Redacted } from "effect";

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
} as const;

// Cache TTL
export const CACHE_TTL = {
  COINGECKO_PRICE: Duration.minutes(5),
  COINGECKO_TOP_CRYPTOS: Duration.minutes(5),
  COINGECKO_HISTORICAL: Duration.minutes(60), // Historical data changes less often
  HEATMAP: Duration.minutes(5),
  ANALYSIS: Duration.minutes(1), // Fast signal updates
  BUYBACK_SIGNALS: Duration.minutes(15),
  BUYBACK_OVERVIEW: Duration.minutes(15),
  BUYBACK_PROTOCOL: Duration.minutes(15),
  TREASURY_HOLDINGS: Duration.hours(1), // Very slow changing
  TREASURY_TRANSACTIONS: Duration.hours(1), // Slow changing
  TREASURY_ENTITIES: Duration.hours(24),
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
} as const;

// Default limits
export const DEFAULT_LIMITS = {
  TOP_CRYPTOS: 100,
  TOP_CRYPTOS_EXTENDED: 250,
  ANALYSIS_ASSETS: 100,
  BUYBACK_SIGNALS: 50,
  HEATMAP: 100,
  MAX_HEATMAP: 200,
} as const;

// WebSocket config
export const WS_CONFIG = {
  RECONNECT_DELAY_MS: 5000,
  MAX_RECONNECT_ATTEMPTS: 10,
  PING_INTERVAL_MS: 30000,
  PONG_TIMEOUT_MS: 10000,
  CLEANUP_INTERVAL: Duration.minutes(1),
} as const;
