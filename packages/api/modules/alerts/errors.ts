import { Data } from "effect";

class LimitExceeded extends Data.TaggedError("LimitExceeded")<{
  readonly limit: number;
}> {}

class NotFound extends Data.TaggedError("NotFound")<{
  readonly id: string;
}> {}

class InvalidRule extends Data.TaggedError("InvalidRule")<{
  readonly message: string;
}> {}

class Db extends Data.TaggedError("Db")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export type AlertsError = LimitExceeded | NotFound | InvalidRule | Db;

export const AlertsErrors = {
  LimitExceeded,
  NotFound,
  InvalidRule,
  Db,
} as const;

export const errorMessage = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);
