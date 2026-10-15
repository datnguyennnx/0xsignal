import { describe, expect, it } from "vitest";
import { OAuthCallbackFailed, UserSuspended, EncryptionFailed } from "../domain/errors";

describe("AuthError tagged errors", () => {
  it("OAuthCallbackFailed stores cause", () => {
    const cause = new Error("Provider unavailable");
    const error = new OAuthCallbackFailed({ cause });
    expect(error.cause).toBe(cause);
  });

  it("UserSuspended stores userId", () => {
    const error = new UserSuspended({ userId: "abc-123" });
    expect(error.userId).toBe("abc-123");
  });

  it("EncryptionFailed stores cause", () => {
    const cause = new Error("Crypto error");
    const error = new EncryptionFailed({ cause });
    expect(error.cause).toBe(cause);
  });
});
