import { Data } from "effect";

// Formula Errors
export class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly formula: string;
  readonly errors: ReadonlyArray<string>;
}> {}

export class InsufficientDataError extends Data.TaggedError("InsufficientDataError")<{
  readonly formula: string;
  readonly required: number;
  readonly actual: number;
}> {}

export class CalculationError extends Data.TaggedError("CalculationError")<{
  readonly formula: string;
  readonly reason: string;
}> {}

export class InvalidDataError extends Data.TaggedError("InvalidDataError")<{
  readonly formula: string;
  readonly issues: ReadonlyArray<string>;
}> {}

// Analysis Errors
export class AnalysisError extends Data.TaggedError("AnalysisError")<{
  readonly message: string;
  readonly symbol?: string;
  readonly cause?: unknown;
}> {}

// Strategy Errors
export class StrategyError extends Data.TaggedError("StrategyError")<{
  readonly strategy: string;
  readonly message: string;
  readonly cause?: unknown;
}> {}

// Infrastructure Errors
export class CacheError extends Data.TaggedError("CacheError")<{
  readonly operation: "get" | "set" | "clear";
  readonly message: string;
}> {}

export class MarketDataError extends Data.TaggedError("MarketDataError")<{
  readonly source: string;
  readonly message: string;
  readonly symbol?: string;
}> {}

// Union type for all domain errors
export type DomainError =
  | ValidationError
  | InsufficientDataError
  | CalculationError
  | InvalidDataError
  | AnalysisError
  | StrategyError
  | CacheError
  | MarketDataError;
