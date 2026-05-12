import { DomainError } from "../errors";

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
        return new DomainError({ code: "VALIDATION_ERROR", message, cause: error });
      }

      if (candidate.kind === "NOT_FOUND") {
        return new DomainError({ code: "NOT_FOUND", message, cause: error });
      }

      if (candidate.kind === "UPSTREAM") {
        return new DomainError({ code: "INTERNAL_ERROR", message, cause: error });
      }

      return new DomainError({ code: "VALIDATION_ERROR", message, cause: error });
    }

    return new DomainError({ code: "VALIDATION_ERROR", message: fallbackMessage, cause: error });
  };
