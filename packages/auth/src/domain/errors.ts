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

export class CredentialNotFound extends Data.TaggedError("CredentialNotFound")<{
  readonly credentialId: string;
}> {}
export class CredentialRevoked extends Data.TaggedError("CredentialRevoked")<{
  readonly credentialId: string;
}> {}
export class CredentialExpired extends Data.TaggedError("CredentialExpired")<{
  readonly credentialId: string;
}> {}
export class CredentialUnverified extends Data.TaggedError("CredentialUnverified")<{
  readonly credentialId: string;
}> {}
export class AccountNotFound extends Data.TaggedError("AccountNotFound")<{
  readonly accountId: string;
}> {}
export class DuplicateLabel extends Data.TaggedError("DuplicateLabel")<{
  readonly label: string;
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
  | CredentialNotFound
  | CredentialRevoked
  | CredentialExpired
  | CredentialUnverified
  | AccountNotFound
  | DuplicateLabel;
