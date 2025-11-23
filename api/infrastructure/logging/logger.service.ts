import { Effect, Context, Layer, LogLevel } from "effect";

/**
 * Structured log levels
 */
export type AppLogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

/**
 * Structured log entry
 */
export interface LogEntry {
  readonly level: AppLogLevel;
  readonly message: string;
  readonly context?: string;
  readonly data?: Record<string, unknown>;
  readonly timestamp?: Date;
}

/**
 * Logger service interface (functional)
 */
export interface LoggerService {
  readonly debug: (message: string, data?: Record<string, unknown>) => Effect.Effect<void>;
  readonly info: (message: string, data?: Record<string, unknown>) => Effect.Effect<void>;
  readonly warn: (message: string, data?: Record<string, unknown>) => Effect.Effect<void>;
  readonly error: (message: string, data?: Record<string, unknown>) => Effect.Effect<void>;
  readonly withContext: (context: string) => LoggerService;
}

export class Logger extends Context.Tag("Logger")<Logger, LoggerService>() {}

/**
 * Create a logger with context
 */
const createLogger = (context?: string, minLevel: AppLogLevel = "INFO"): LoggerService => {
  const shouldLog = (level: AppLogLevel): boolean => {
    const levels: AppLogLevel[] = ["DEBUG", "INFO", "WARN", "ERROR"];
    return levels.indexOf(level) >= levels.indexOf(minLevel);
  };

  const log = (level: AppLogLevel, message: string, data?: Record<string, unknown>) =>
    Effect.sync(() => {
      if (!shouldLog(level)) return;

      const timestamp = new Date().toISOString();

      const entry: LogEntry = {
        level,
        message,
        context,
        data,
        timestamp: new Date(),
      };

      // ANSI color codes
      const colors = {
        reset: "\x1b[0m",
        timestamp: "\x1b[90m", // Gray
        debug: "\x1b[36m", // Cyan
        info: "\x1b[32m", // Green
        warn: "\x1b[33m", // Yellow
        error: "\x1b[31m", // Red
        context: "\x1b[35m", // Magenta
        data: "\x1b[90m", // Gray
      };

      // Format log message with colors
      const timestampStr = `${colors.timestamp}[${timestamp}]${colors.reset}`;
      const levelColor =
        level === "DEBUG"
          ? colors.debug
          : level === "INFO"
            ? colors.info
            : level === "WARN"
              ? colors.warn
              : colors.error;
      const levelStr = `${levelColor}[${level}]${colors.reset}`;
      const contextStr = context ? `${colors.context}[${context}]${colors.reset}` : "";
      const dataStr = data ? ` ${colors.data}${JSON.stringify(data)}${colors.reset}` : "";
      const logMessage = `${timestampStr} ${levelStr}${contextStr} ${message}${dataStr}`;

      // Use Effect's built-in logging with appropriate level
      switch (level) {
        case "DEBUG":
          console.debug(logMessage);
          break;
        case "INFO":
          console.log(logMessage);
          break;
        case "WARN":
          console.warn(logMessage);
          break;
        case "ERROR":
          console.error(logMessage);
          break;
      }
    });

  return {
    debug: (message: string, data?: Record<string, unknown>) => log("DEBUG", message, data),
    info: (message: string, data?: Record<string, unknown>) => log("INFO", message, data),
    warn: (message: string, data?: Record<string, unknown>) => log("WARN", message, data),
    error: (message: string, data?: Record<string, unknown>) => log("ERROR", message, data),
    withContext: (newContext: string) => createLogger(newContext, minLevel),
  };
};

/**
 * Live implementation with configurable log level
 */
export const LoggerLive = (minLevel: AppLogLevel = "INFO") =>
  Layer.succeed(Logger, createLogger(undefined, minLevel));

/**
 * Default logger (INFO level)
 */
export const LoggerLiveDefault = LoggerLive("INFO");

/**
 * Helper to create contextual loggers
 */
export const withLogger = <R, E, A>(
  context: string,
  effect: (logger: LoggerService) => Effect.Effect<A, E, R>
): Effect.Effect<A, E, R | Logger> =>
  Effect.gen(function* () {
    const logger = yield* Logger;
    const contextLogger = logger.withContext(context);
    return yield* effect(contextLogger);
  });
