import { Data } from "effect";

// Application-specific errors following Effect patterns
export class ConfigError extends Data.TaggedError("ConfigError")<{
  readonly message: string;
  readonly configKey?: string;
}> {}

export class AnalysisError extends Data.TaggedError("AnalysisError")<{
  readonly message: string;
  readonly symbol?: string;
}> {}

export class MonitoringError extends Data.TaggedError("MonitoringError")<{
  readonly message: string;
  readonly details?: unknown;
}> {}
