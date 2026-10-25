import { Data } from "effect";

export class CredentialVerificationError extends Data.TaggedError("CredentialVerificationError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}
