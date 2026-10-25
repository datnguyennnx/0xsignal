import { Data } from "effect";

/**
 * Application-level failures. Each one maps to a single HTTP status in
 * `app/error-mapping.ts`, so they are edited as one set.
 */
export class ConflictError extends Data.TaggedError("ConflictError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class HealthError extends Data.TaggedError("HealthError")<{
  readonly status: number;
  readonly message: string;
}> {}

export class InternalError extends Data.TaggedError("InternalError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class NotFoundError extends Data.TaggedError("NotFoundError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class ServiceUnavailableError extends Data.TaggedError("ServiceUnavailableError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export type AppError =
  | NotFoundError
  | ConflictError
  | ValidationError
  | InternalError
  | ServiceUnavailableError;

/**
 * Exchange-domain failures. The classifier in
 * `modules/exchange/error-classification.ts` picks among them as a set, and
 * the HTTP layer maps each to its own status: internal -> 502, validation and
 * insufficient margin -> 400.
 */
export class HyperliquidInternalError extends Data.TaggedError("HyperliquidInternalError")<{
  readonly message: string;
  readonly cause?: unknown;
  readonly symbol?: string;
  readonly endpoint?: string;
  readonly input?: unknown;
}> {}

export class HyperliquidValidationError extends Data.TaggedError("HyperliquidValidationError")<{
  readonly message: string;
  readonly cause?: unknown;
  readonly symbol?: string;
  readonly input?: unknown;
}> {}

export class InsufficientMarginError extends Data.TaggedError("InsufficientMarginError")<{
  readonly message: string;
  readonly symbol?: string;
  readonly required?: string;
  readonly available?: string;
}> {}
