export type { UserId, User, UserStatus } from "./domain/user";
export type { OAuthProvider, OAuthAccount, OAuthProfile } from "./domain/oauth-account";
export type { Session, JwtPayload, AuthTokens } from "./domain/session";
export type { AuthError } from "./domain/errors";

export {
  OAuthStateMismatch,
  OAuthStateExpired,
  OAuthCallbackFailed,
  TokenExpired,
  TokenInvalid,
  TokenRevoked,
  UserSuspended,
  AccountNotFound,
  DuplicateLabel,
  CredentialNotFound,
  CredentialRevoked,
  CredentialExpired,
  CredentialUnverified,
  EncryptionFailed,
} from "./domain/errors";

export { AuthService } from "./application/auth.service";

export { authLayer, AuthInfraLayer } from "./auth.layer";

export { withAuth } from "./presentation/require-auth";
export { buildAuthRoutes } from "./presentation/auth.routes";

export { MigrationLayer } from "./infrastructure/migration.layer";

export { PostgresConnectionPool } from "./infrastructure/db/postgres";
export { ExchangeAccountRepo } from "./infrastructure/repos/exchange-account.repo";
export { ExchangeCredentialRepo } from "./infrastructure/repos/exchange-credential.repo";
