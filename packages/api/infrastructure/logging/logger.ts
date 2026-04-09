/** Effect-native Logging */

import { Logger, LogLevel, Layer, Match } from "effect";

export type AppLogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

// Log level mapping using pattern matching
const toEffectLogLevel = Match.type<AppLogLevel>().pipe(
  Match.when("DEBUG", () => LogLevel.Debug),
  Match.when("INFO", () => LogLevel.Info),
  Match.when("WARN", () => LogLevel.Warning),
  Match.when("ERROR", () => LogLevel.Error),
  Match.exhaustive
);

export const withLogLevel = (level: AppLogLevel) => Logger.minimumLogLevel(toEffectLogLevel(level));

// Development: pretty + INFO
export const DevLoggerLive = Layer.mergeAll(Logger.pretty, withLogLevel("INFO"));
