import { Data } from "effect";

export class OAuthStateMismatch extends Data.TaggedError("OAuthStateMismatch")<{}> {}
export class OAuthStateExpired extends Data.TaggedError("OAuthStateExpired")<{}> {}
export class OAuthCallbackFailed extends Data.TaggedError("OAuthCallbackFailed")<{
  cause: unknown;
}> {}
export class TokenExpired extends Data.TaggedError("TokenExpired")<{}> {}
export class TokenInvalid extends Data.TaggedError("TokenInvalid")<{}> {}
export class TokenRevoked extends Data.TaggedError("TokenRevoked")<{}> {}
export class UserSuspended extends Data.TaggedError("UserSuspended")<{ userId: string }> {}
export class EncryptionFailed extends Data.TaggedError("EncryptionFailed")<{ cause: unknown }> {}
export class ServiceUnavailable extends Data.TaggedError("ServiceUnavailable")<{
  readonly service: string;
  readonly reason: string;
}> {}

export type AuthError =
  | OAuthStateMismatch
  | OAuthStateExpired
  | OAuthCallbackFailed
  | TokenExpired
  | TokenInvalid
  | TokenRevoked
  | UserSuspended
  | EncryptionFailed
  | ServiceUnavailable;
