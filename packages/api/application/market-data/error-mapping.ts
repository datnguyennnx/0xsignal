import { Match } from "effect";
import { DomainError } from "../errors";

export const mapMarketInfraError =
  (fallbackMessage: string) =>
  (error: unknown): DomainError =>
    Match.type<unknown>().pipe(
      Match.when(Match.instanceOf(DomainError), (e) => e),
      Match.when(
        (e: unknown): e is { message?: unknown; kind?: unknown } =>
          typeof e === "object" && e !== null,
        (candidate) => {
          const message =
            typeof candidate.message === "string" ? candidate.message : fallbackMessage;
          return mapKindToDomainError(candidate.kind, message, candidate);
        }
      ),
      Match.orElse(
        () => new DomainError({ code: "INTERNAL_ERROR", message: fallbackMessage, cause: error })
      )
    )(error);

const mapKindToDomainError = (kind: unknown, message: string, cause: unknown): DomainError =>
  Match.value(kind).pipe(
    Match.when("BAD_REQUEST", () => new DomainError({ code: "VALIDATION_ERROR", message, cause })),
    Match.when("NOT_FOUND", () => new DomainError({ code: "NOT_FOUND", message, cause })),
    Match.when("UPSTREAM", () => new DomainError({ code: "INTERNAL_ERROR", message, cause })),
    Match.orElse(() => new DomainError({ code: "INTERNAL_ERROR", message, cause }))
  );
