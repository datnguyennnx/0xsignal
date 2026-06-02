import { describe, expect, it } from "vitest";
import type { UserId, User, UserStatus } from "../domain/user";
import type { OAuthProvider, OAuthAccount, OAuthProfile } from "../domain/oauth-account";
import type { Session, JwtPayload, AuthTokens } from "../domain/session";

describe("domain types", () => {
  it("UserId is assignable from string", () => {
    const id: UserId = "abc-123" as UserId;
    expect(typeof id).toBe("string");
  });

  it("UserStatus is a string union", () => {
    const active: UserStatus = "active";
    const suspended: UserStatus = "suspended";
    const banned: UserStatus = "banned";
    expect(active).toBe("active");
    expect(suspended).toBe("suspended");
    expect(banned).toBe("banned");
  });

  it("User interface has required fields", () => {
    const user: User = {
      id: "user-1" as UserId,
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(user.id).toBe("user-1");
    expect(user.status).toBe("active");
  });

  it("OAuthProvider is a string union", () => {
    const google: OAuthProvider = "google";
    const github: OAuthProvider = "github";
    expect(google).toBe("google");
    expect(github).toBe("github");
  });

  it("OAuthAccount interface has provider unique constraint fields", () => {
    const account: OAuthAccount = {
      id: "acct-1",
      userId: "user-1" as UserId,
      provider: "google",
      providerUserId: "12345",
      email: "test@gmail.com",
      displayName: "Test User",
      avatarUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(account.provider).toBe("google");
    expect(account.providerUserId).toBe("12345");
  });

  it("OAuthProfile allows null email and displayName", () => {
    const profile: OAuthProfile = {
      provider: "github",
      providerUserId: "67890",
      email: null,
      displayName: null,
      avatarUrl: null,
    };
    expect(profile.email).toBeNull();
    expect(profile.displayName).toBeNull();
  });

  it("Session has required fields", () => {
    const session: Session = {
      userId: "user-1" as UserId,
      provider: "google",
      jti: "jti-abc",
    };
    expect(session.jti).toBe("jti-abc");
  });

  it("AuthTokens has Bearer token type", () => {
    const tokens: AuthTokens = {
      accessToken: "access",
      refreshToken: "refresh",
      tokenType: "Bearer",
      expiresIn: 900,
    };
    expect(tokens.tokenType).toBe("Bearer");
  });

  it("JwtPayload has timestamp fields", () => {
    const payload: JwtPayload = {
      sub: "user-1" as UserId,
      provider: "google",
      jti: "jti-1",
      iat: 1000000,
      exp: 1000900,
    };
    expect(payload.iat).toBe(1000000);
    expect(payload.exp).toBe(1000900);
  });
});
