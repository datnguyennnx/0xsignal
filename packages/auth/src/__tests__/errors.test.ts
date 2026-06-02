import { describe, expect, it } from "vitest";
import {
  OAuthStateMismatch,
  OAuthStateExpired,
  OAuthCallbackFailed,
  TokenExpired,
  TokenInvalid,
  TokenRevoked,
  UserSuspended,
  EncryptionFailed,
} from "../domain/errors";

describe("AuthError tagged errors", () => {
  it("OAuthStateMismatch has correct _tag", () => {
    const error = new OAuthStateMismatch();
    expect(error._tag).toBe("OAuthStateMismatch");
  });

  it("OAuthStateExpired has correct _tag", () => {
    const error = new OAuthStateExpired();
    expect(error._tag).toBe("OAuthStateExpired");
  });

  it("OAuthCallbackFailed stores cause", () => {
    const cause = new Error("Provider unavailable");
    const error = new OAuthCallbackFailed({ cause });
    expect(error._tag).toBe("OAuthCallbackFailed");
    expect(error.cause).toBe(cause);
  });

  it("TokenExpired has correct _tag", () => {
    const error = new TokenExpired();
    expect(error._tag).toBe("TokenExpired");
  });

  it("TokenInvalid has correct _tag", () => {
    const error = new TokenInvalid();
    expect(error._tag).toBe("TokenInvalid");
  });

  it("TokenRevoked has correct _tag", () => {
    const error = new TokenRevoked();
    expect(error._tag).toBe("TokenRevoked");
  });

  it("UserSuspended stores userId", () => {
    const error = new UserSuspended({ userId: "abc-123" });
    expect(error._tag).toBe("UserSuspended");
    expect(error.userId).toBe("abc-123");
  });

  it("EncryptionFailed stores cause", () => {
    const cause = new Error("Crypto error");
    const error = new EncryptionFailed({ cause });
    expect(error._tag).toBe("EncryptionFailed");
    expect(error.cause).toBe(cause);
  });
});
