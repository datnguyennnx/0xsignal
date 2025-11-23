import { Data } from "effect";

export class ApiError extends Data.TaggedError("ApiError")<{
  readonly message: string;
  readonly status?: number;
  readonly statusText?: string;
}> {}

export class NetworkError extends Data.TaggedError("NetworkError")<{
  readonly message: string;
}> {}
