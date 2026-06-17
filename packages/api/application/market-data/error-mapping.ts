import { Match } from "effect";
import { MarketProviderError } from "./contracts";
import { NotFoundError, ValidationError, InternalError } from "../errors";
import type { AppError } from "../errors";

export const mapMarketInfraError =
  (fallbackMessage: string) =>
  (error: MarketProviderError): AppError =>
    Match.value(error.kind).pipe(
      Match.when(
        "BAD_REQUEST",
        () => new ValidationError({ message: error.message, cause: error }),
      ),
      Match.when("NOT_FOUND", () => new NotFoundError({ message: error.message, cause: error })),
      Match.when("UPSTREAM", () => new InternalError({ message: error.message, cause: error })),
      Match.when("RATE_LIMITED", () => new InternalError({ message: error.message, cause: error })),
      Match.when("INTERNAL", () => new InternalError({ message: error.message, cause: error })),
      Match.orElse(() => new InternalError({ message: fallbackMessage, cause: error })),
    );
