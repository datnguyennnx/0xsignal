// ============================================================================
// FORMULA ERRORS - FUNCTIONAL APPROACH
// ============================================================================
// Standardized error types using Effect-TS Data.TaggedError
// Pure functional approach - no classes, just tagged data types
// ============================================================================

import { Data } from "effect";

/**
 * Error when input validation fails
 */
export class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly formula: string;
  readonly errors: ReadonlyArray<string>;
}> {}

/**
 * Error when insufficient data is provided for calculation
 */
export class InsufficientDataError extends Data.TaggedError("InsufficientDataError")<{
  readonly formula: string;
  readonly required: number;
  readonly actual: number;
}> {}

/**
 * Error when calculation fails
 */
export class CalculationError extends Data.TaggedError("CalculationError")<{
  readonly formula: string;
  readonly reason: string;
}> {}

/**
 * Error when invalid data is provided
 */
export class InvalidDataError extends Data.TaggedError("InvalidDataError")<{
  readonly formula: string;
  readonly issues: ReadonlyArray<string>;
}> {}
