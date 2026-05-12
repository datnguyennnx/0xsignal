import { Data } from "effect";

export type DomainErrorCode =
  | "NOT_FOUND"
  | "ALREADY_EXISTS"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR"
  | "INVALID_STATE"
  | "CONFLICT"
  | "FORBIDDEN";

export class DomainError extends Data.TaggedError("DomainError")<{
  readonly code: DomainErrorCode;
  readonly message: string;
  readonly cause?: unknown;
}> {}
