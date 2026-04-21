import { DomainError, domainError, notFoundError, validationError } from "../errors";

export const mapMarketInfraError =
  (fallbackMessage: string) =>
  (error: unknown): DomainError => {
    if (error instanceof DomainError) {
      return error;
    }

    if (typeof error === "object" && error !== null) {
      const candidate = error as {
        message?: unknown;
        kind?: unknown;
      };
      const message = typeof candidate.message === "string" ? candidate.message : fallbackMessage;

      if (candidate.kind === "BAD_REQUEST") {
        return validationError(message, error);
      }

      if (candidate.kind === "NOT_FOUND") {
        return notFoundError(message, error);
      }

      if (candidate.kind === "UPSTREAM") {
        return domainError("INTERNAL_ERROR", message, error);
      }

      return validationError(message, error);
    }

    return validationError(fallbackMessage, error);
  };
