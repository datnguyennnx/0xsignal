import { Layer, Logger, Match } from "effect";
import { MinimumLogLevel } from "effect/References";

export type AppLogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

const toEffectLogLevel = (level: AppLogLevel): "Debug" | "Info" | "Warn" | "Error" =>
  Match.value(level).pipe(
    Match.when("DEBUG", () => "Debug" as const),
    Match.when("INFO", () => "Info" as const),
    Match.when("WARN", () => "Warn" as const),
    Match.when("ERROR", () => "Error" as const),
    Match.exhaustive,
  );

export const withLogLevel = (level: AppLogLevel) =>
  Layer.succeed(MinimumLogLevel, toEffectLogLevel(level));

export const devLoggerLayer = Layer.mergeAll(
  Logger.layer([Logger.consolePretty()]),
  withLogLevel("INFO"),
);
