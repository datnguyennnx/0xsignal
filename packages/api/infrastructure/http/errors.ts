/** HTTP Client error types */

import { Data } from "effect";

// Errors
export class HttpError extends Data.TaggedError("HttpError")<{
  readonly message: string;
  readonly status?: number;
  readonly url?: string;
}> {}

export class HttpParseError extends Data.TaggedError("HttpParseError")<{
  readonly message: string;
  readonly url: string;
}> {}
