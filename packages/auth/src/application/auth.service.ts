import { Context, Effect } from "effect";
import type { OAuthProvider } from "../domain/oauth-account";
import type { AuthTokens, Session } from "../domain/session";
import type { AuthError } from "../domain/errors";

export interface UserProfile {
  readonly userId: string;
  readonly provider: OAuthProvider;
  readonly avatarUrl: string | null;
  readonly displayName: string | null;
}

export class AuthService extends Context.Service<
  AuthService,
  {
    readonly getAuthorizationUrl: (params: {
      provider: OAuthProvider;
      redirectUrl?: string;
    }) => Effect.Effect<{ url: string; state: string }, AuthError>;

    readonly handleCallback: (params: {
      provider: OAuthProvider;
      code: string;
      state: string;
    }) => Effect.Effect<{ code: string }, AuthError>;

    readonly exchangeCode: (code: string) => Effect.Effect<AuthTokens, AuthError>;

    readonly verifyToken: (accessToken: string) => Effect.Effect<Session, AuthError>;

    readonly refreshTokens: (refreshToken: string) => Effect.Effect<AuthTokens, AuthError>;

    readonly logout: (refreshToken: string) => Effect.Effect<void, AuthError>;

    readonly getProfile: (userId: string) => Effect.Effect<UserProfile | null>;

    readonly updateProfile: (
      userId: string,
      params: { displayName: string }
    ) => Effect.Effect<UserProfile>;
  }
>()("AuthService") {}
