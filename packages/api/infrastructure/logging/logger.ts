/** Effect-native Logging */

import { Layer, Logger } from "effect";
import { MinimumLogLevel } from "effect/References";

export type AppLogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

const toEffectLogLevel = (level: AppLogLevel): "Debug" | "Info" | "Warn" | "Error" => {
  switch (level) {
    case "DEBUG":
      return "Debug";
    case "INFO":
      return "Info";
    case "WARN":
      return "Warn";
    case "ERROR":
      return "Error";
  }
};

export const withLogLevel = (level: AppLogLevel) =>
  Layer.succeed(MinimumLogLevel, toEffectLogLevel(level));

// Development: pretty + INFO
export const devLoggerLayer = Layer.mergeAll(
  Logger.layer([Logger.consolePretty()]),
  withLogLevel("INFO")
);
