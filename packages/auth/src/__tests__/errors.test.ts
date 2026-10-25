import { describe, expect, it } from "vitest";
import { OAuthCallbackFailed, UserSuspended } from "../domain/errors";

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
});
