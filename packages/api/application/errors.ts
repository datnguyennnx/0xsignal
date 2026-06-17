import { Data } from "effect";

export class NotFoundError extends Data.TaggedError("NotFoundError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class ConflictError extends Data.TaggedError("ConflictError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class InternalError extends Data.TaggedError("InternalError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export type AppError = NotFoundError | ConflictError | ValidationError | InternalError;
