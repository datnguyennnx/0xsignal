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
} from "./domain/errors";

export { AuthService } from "./application/auth.service";

export { authLayer } from "./auth.layer";

export { withAuth } from "./presentation/require-auth";
export { buildAuthRoutes } from "./presentation/auth.routes";

export { MigrationLayer } from "./infrastructure/migration.layer";
