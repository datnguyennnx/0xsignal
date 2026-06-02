import type { UserId } from "./user";
import type { OAuthProvider } from "./oauth-account";

export interface JwtPayload {
  readonly sub: UserId;
  readonly provider: OAuthProvider;
  readonly jti: string;
  readonly iat: number;
  readonly exp: number;
}

export interface Session {
  readonly userId: UserId;
  readonly provider: OAuthProvider;
  readonly jti: string;
}

export interface AuthTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly tokenType: "Bearer";
  readonly expiresIn: number;
}
