import { describe, expect, it, vi } from "vitest";
import { Effect, Layer, ManagedRuntime } from "effect";
import { AuthService } from "../application/auth.service";
import { withAuth } from "../presentation/require-auth";
import { Session } from "../domain/session";
import { TokenExpired, TokenInvalid } from "../domain/errors";
import type { UserId } from "../domain/user";
import type { OAuthProvider } from "../domain/oauth-account";

const mockUserId = "user-1" as unknown as UserId;
const mockSession: Session = {
  userId: mockUserId,
  provider: "google" as OAuthProvider,
  jti: "jti-1",
};

describe("withAuth guard", () => {
  it("extracts Bearer token and returns session on success", async () => {
    const mockAuthService = {
      getAuthorizationUrl: vi.fn(),
      handleCallback: vi.fn(),
      verifyToken: vi.fn().mockReturnValue(Effect.succeed(mockSession)),
      refreshTokens: vi.fn(),
      logout: vi.fn(),
    };

    const TestLayer = Layer.succeed(AuthService, mockAuthService);
    const runtime = ManagedRuntime.make(TestLayer);

    const handler = vi
      .fn()
      .mockImplementation((session: Session) =>
        Effect.succeed(new Response(JSON.stringify({ userId: session.userId }), { status: 200 })),
      );

    const request = new Request("http://localhost/api/auth/me", {
      headers: { Authorization: "Bearer valid-token" },
    });

    const guard = withAuth(handler);
    const result = await runtime.runPromise(guard(request));

    expect(result.status).toBe(200);
    const body = await result.json();
    expect(body.userId).toBe("user-1");
    expect(mockAuthService.verifyToken).toHaveBeenCalledWith("valid-token");
    expect(handler).toHaveBeenCalledWith(mockSession);
  });

  it("returns 401 when no token is present", async () => {
    const mockAuthService = {
      getAuthorizationUrl: vi.fn(),
      handleCallback: vi.fn(),
      verifyToken: vi.fn(),
      refreshTokens: vi.fn(),
      logout: vi.fn(),
    };

    const TestLayer = Layer.succeed(AuthService, mockAuthService);
    const runtime = ManagedRuntime.make(TestLayer);

    const handler = vi.fn();
    const request = new Request("http://localhost/api/auth/me");
    // No Authorization header

    const guard = withAuth(handler);
    const result = await runtime.runPromise(guard(request));

    expect(result.status).toBe(401);
    const body = await result.json();
    expect(body.error).toBe("Unauthorized");
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 401 when token is expired", async () => {
    const mockAuthService = {
      getAuthorizationUrl: vi.fn(),
      handleCallback: vi.fn(),
      verifyToken: vi.fn().mockReturnValue(Effect.fail(new TokenExpired())),
      refreshTokens: vi.fn(),
      logout: vi.fn(),
    };

    const TestLayer = Layer.succeed(AuthService, mockAuthService);
    const runtime = ManagedRuntime.make(TestLayer);

    const handler = vi.fn();
    const request = new Request("http://localhost/api/auth/me", {
      headers: { Authorization: "Bearer expired-token" },
    });

    const guard = withAuth(handler);
    const result = await runtime.runPromise(guard(request));

    expect(result.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("extracts token from cookie when no Authorization header", async () => {
    const mockAuthService = {
      getAuthorizationUrl: vi.fn(),
      handleCallback: vi.fn(),
      verifyToken: vi.fn().mockReturnValue(Effect.succeed(mockSession)),
      refreshTokens: vi.fn(),
      logout: vi.fn(),
    };

    const TestLayer = Layer.succeed(AuthService, mockAuthService);
    const runtime = ManagedRuntime.make(TestLayer);

    const handler = vi
      .fn()
      .mockImplementation(() => Effect.succeed(new Response("{}", { status: 200 })));

    const request = new Request("http://localhost/api/auth/me", {
      headers: { cookie: "access_token=cookie-token; other=value" },
    });

    const guard = withAuth(handler);
    await runtime.runPromise(guard(request));

    expect(mockAuthService.verifyToken).toHaveBeenCalledWith("cookie-token");
  });
});
