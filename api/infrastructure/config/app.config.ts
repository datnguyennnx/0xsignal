import { Config } from "effect";

// Application configuration using Effect Config
export const AppConfig = Config.all({
  coingeckoApiKey: Config.string("COINGECKO_API_KEY").pipe(
    Config.withDefault("")
  ),
  monitoringInterval: Config.number("MONITORING_INTERVAL").pipe(
    Config.withDefault(5)
  ),
  symbolsLimit: Config.number("SYMBOLS_LIMIT").pipe(
    Config.withDefault(20)
  ),
  enableAlerts: Config.boolean("ENABLE_ALERTS").pipe(
    Config.withDefault(true)
  ),
  port: Config.number("PORT").pipe(
    Config.withDefault(3000)
  ),
  logLevel: Config.string("LOG_LEVEL").pipe(
    Config.withDefault("info")
  ),
});

export type AppConfig = Config.Config.Success<typeof AppConfig>;
