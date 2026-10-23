import { Data } from "effect";

/**
 * Application-layer failures. Each one maps to a single HTTP status in
 * `presentation/http/error-response.ts`, so they are edited as one set.
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

export class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export type AppError = NotFoundError | ConflictError | ValidationError | InternalError;
