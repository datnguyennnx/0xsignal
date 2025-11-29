/** Domain Errors - Tagged errors with Match support */

import { Data, Match } from "effect";

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

// Union types
export type FormulaError =
  | ValidationError
  | InsufficientDataError
  | CalculationError
  | InvalidDataError;
export type DomainError =
  | FormulaError
  | AnalysisError
  | StrategyError
  | CacheError
  | MarketDataError;

// Error matchers for type-safe error handling
export const matchFormulaError = Match.type<FormulaError>().pipe(
  Match.tag("ValidationError", (e) => ({
    code: "VALIDATION",
    message: `Validation failed: ${e.errors.join(", ")}`,
  })),
  Match.tag("InsufficientDataError", (e) => ({
    code: "INSUFFICIENT_DATA",
    message: `Need ${e.required} points, got ${e.actual}`,
  })),
  Match.tag("CalculationError", (e) => ({ code: "CALCULATION", message: e.reason })),
  Match.tag("InvalidDataError", (e) => ({ code: "INVALID_DATA", message: e.issues.join(", ") })),
  Match.exhaustive
);

export const matchDomainError = Match.type<DomainError>().pipe(
  Match.tag("ValidationError", (e) => ({
    status: 400,
    message: `Validation: ${e.errors.join(", ")}`,
  })),
  Match.tag("InsufficientDataError", (e) => ({
    status: 400,
    message: `Insufficient data: need ${e.required}`,
  })),
  Match.tag("CalculationError", (e) => ({
    status: 500,
    message: `Calculation error: ${e.reason}`,
  })),
  Match.tag("InvalidDataError", (e) => ({
    status: 400,
    message: `Invalid data: ${e.issues.join(", ")}`,
  })),
  Match.tag("AnalysisError", (e) => ({ status: 500, message: e.message })),
  Match.tag("StrategyError", (e) => ({
    status: 500,
    message: `Strategy ${e.strategy}: ${e.message}`,
  })),
  Match.tag("CacheError", (e) => ({ status: 500, message: `Cache ${e.operation}: ${e.message}` })),
  Match.tag("MarketDataError", (e) => ({ status: 502, message: `${e.source}: ${e.message}` })),
  Match.exhaustive
);

// Helper to convert any error to HTTP response format
export const toHttpError = (error: DomainError) => matchDomainError(error);
