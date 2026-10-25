import { Data } from "effect";

/**
 * Every failure the auth package raises. They live together because consumers
 * catch them as a set and `AuthError` is their union, not a selection.
 */
export class OAuthStateMismatch extends Data.TaggedError("OAuthStateMismatch")<
  Record<never, never>
> {}

export class OAuthStateExpired extends Data.TaggedError("OAuthStateExpired")<
  Record<never, never>
> {}

export class OAuthCallbackFailed extends Data.TaggedError("OAuthCallbackFailed")<{
  cause: unknown;
}> {}

export class TokenExpired extends Data.TaggedError("TokenExpired")<Record<never, never>> {}

export class TokenInvalid extends Data.TaggedError("TokenInvalid")<Record<never, never>> {}

export class TokenRevoked extends Data.TaggedError("TokenRevoked")<Record<never, never>> {}

export class UserSuspended extends Data.TaggedError("UserSuspended")<{ userId: string }> {}

export class AccountNotFound extends Data.TaggedError("AccountNotFound")<{
  readonly accountId: string;
}> {}

export class DuplicateLabel extends Data.TaggedError("DuplicateLabel")<{
  readonly label: string;
}> {}

export class WalletAddressClaimed extends Data.TaggedError("WalletAddressClaimed")<{
  readonly walletAddress: string;
}> {}

export class WalletChallengeNotFound extends Data.TaggedError("WalletChallengeNotFound")<{
  readonly nonce: string;
}> {}

export class WalletChallengeExpired extends Data.TaggedError("WalletChallengeExpired")<{
  readonly nonce: string;
}> {}

export class WalletChallengeUsed extends Data.TaggedError("WalletChallengeUsed")<{
  readonly nonce: string;
}> {}

export class WalletChallengeAddressMismatch extends Data.TaggedError(
  "WalletChallengeAddressMismatch",
)<{
  readonly nonce: string;
}> {}

export type AuthError =
  | OAuthStateMismatch
  | OAuthStateExpired
  | OAuthCallbackFailed
  | TokenExpired
  | TokenInvalid
  | TokenRevoked
  | UserSuspended
  | AccountNotFound
  | DuplicateLabel
  | WalletAddressClaimed
  | WalletChallengeNotFound
  | WalletChallengeExpired
  | WalletChallengeUsed
  | WalletChallengeAddressMismatch;
