/** Effect-native Logging */

import { Effect, Logger, LogLevel, Layer, Match } from "effect";

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

// Production: JSON + WARN
export const ProdLoggerLive = Layer.mergeAll(Logger.json, withLogLevel("WARN"));

// Log helpers
export const logDebug = (message: string, data?: Record<string, unknown>) =>
  data ? Effect.logDebug(message).pipe(Effect.annotateLogs(data)) : Effect.logDebug(message);

export const logInfo = (message: string, data?: Record<string, unknown>) =>
  data ? Effect.logInfo(message).pipe(Effect.annotateLogs(data)) : Effect.logInfo(message);

export const logWarn = (message: string, data?: Record<string, unknown>) =>
  data ? Effect.logWarning(message).pipe(Effect.annotateLogs(data)) : Effect.logWarning(message);

export const logError = (message: string, data?: Record<string, unknown>) =>
  data ? Effect.logError(message).pipe(Effect.annotateLogs(data)) : Effect.logError(message);
