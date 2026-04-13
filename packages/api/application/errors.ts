export type DomainErrorCode =
  | "NOT_FOUND"
  | "ALREADY_EXISTS"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR"
  | "INVALID_STATE"
  | "CONFLICT"
  | "FORBIDDEN";

export class DomainError {
  readonly code: DomainErrorCode;
  readonly message: string;
  readonly cause?: unknown;

  constructor(code: DomainErrorCode, message: string, cause?: unknown) {
    this.code = code;
    this.message = message;
    this.cause = cause;
  }
}

export const domainError = (code: DomainErrorCode, message: string, cause?: unknown) =>
  new DomainError(code, message, cause);

export const notFoundError = (message: string, cause?: unknown) =>
  domainError("NOT_FOUND", message, cause);

export const validationError = (message: string, cause?: unknown) =>
  domainError("VALIDATION_ERROR", message, cause);
