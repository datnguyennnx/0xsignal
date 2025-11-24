import { Data } from "effect";

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

export class AnalysisError extends Data.TaggedError("AnalysisError")<{
  readonly message: string;
  readonly symbol?: string;
}> {}
