/**
 * Effect-native Logging
 * Uses Effect's built-in logging with pretty output
 */

import { Effect, Logger, LogLevel, Layer } from "effect";

// Log levels for configuration
export type AppLogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

// Map app log level to Effect LogLevel
const toEffectLogLevel = (level: AppLogLevel): LogLevel.LogLevel => {
  switch (level) {
    case "DEBUG":
      return LogLevel.Debug;
    case "INFO":
      return LogLevel.Info;
    case "WARN":
      return LogLevel.Warning;
    case "ERROR":
      return LogLevel.Error;
  }
};

// Pretty logger layer for development
export const PrettyLoggerLive = Logger.pretty;

// Structured logger layer for production (JSON)
export const StructuredLoggerLive = Logger.json;

// Configure minimum log level
export const withLogLevel = (level: AppLogLevel) => Logger.minimumLogLevel(toEffectLogLevel(level));

// Development logging layer (pretty + INFO level)
export const DevLoggerLive = Layer.mergeAll(PrettyLoggerLive, withLogLevel("INFO"));

// Production logging layer (JSON + WARN level)
export const ProdLoggerLive = Layer.mergeAll(StructuredLoggerLive, withLogLevel("WARN"));

// Log helpers using Effect's built-in logging
export const logDebug = (message: string, data?: Record<string, unknown>) =>
  data ? Effect.logDebug(message).pipe(Effect.annotateLogs(data)) : Effect.logDebug(message);

export const logInfo = (message: string, data?: Record<string, unknown>) =>
  data ? Effect.logInfo(message).pipe(Effect.annotateLogs(data)) : Effect.logInfo(message);

export const logWarn = (message: string, data?: Record<string, unknown>) =>
  data ? Effect.logWarning(message).pipe(Effect.annotateLogs(data)) : Effect.logWarning(message);

export const logError = (message: string, data?: Record<string, unknown>) =>
  data ? Effect.logError(message).pipe(Effect.annotateLogs(data)) : Effect.logError(message);

// Annotate logs for a scope
export const withLogContext = <A, E, R>(
  context: string,
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> => effect.pipe(Effect.annotateLogs({ context }));

// HTTP request logging helper
export const logHttpRequest = (method: string, path: string) =>
  Effect.logInfo(`→ ${method} ${path}`);

// HTTP response logging helper
export const logHttpResponse = (path: string, status: number, durationMs: number) =>
  Effect.logInfo(`← ${status} ${path} (${durationMs}ms)`);

// HTTP error logging helper
export const logHttpError = (path: string, status: number, error: string) =>
  Effect.logError(`✗ ${status} ${path}: ${error}`);

// External API call logging
export const logExternalApi = (
  method: string,
  host: string,
  path: string,
  status: number,
  durationMs: number
) => Effect.logDebug(`↗ ${method} ${host}${path} ${status} (${durationMs}ms)`);
