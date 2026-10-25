import { describe, expect, it, vi } from "vitest";
import { Effect, Layer, ManagedRuntime } from "effect";
import { AuthService } from "../application/auth.service";
import { withAuth } from "../presentation/require-auth";
import { Session } from "../domain/session";
import { TokenExpired } from "../domain/errors";
import { makeUserId } from "../domain/user";

type AuthServiceShape = (typeof AuthService)["Service"];

const mockUserId = makeUserId("user-1");
const mockSession: Session = {
  userId: mockUserId,
  provider: "google",
  jti: "jti-1",
};

const makeAuthServiceMock = () => ({
  getAuthorizationUrl: vi.fn<AuthServiceShape["getAuthorizationUrl"]>(),
  handleCallback: vi.fn<AuthServiceShape["handleCallback"]>(),
  verifyToken: vi.fn<AuthServiceShape["verifyToken"]>(),
  refreshTokens: vi.fn<AuthServiceShape["refreshTokens"]>(),
  logout: vi.fn<AuthServiceShape["logout"]>(),
});

const makeHandlerMock = () =>
  vi
    .fn<(session: Session) => Effect.Effect<Response>>()
    .mockImplementation((session: Session) =>
      Effect.succeed(new Response(JSON.stringify({ userId: session.userId }), { status: 200 })),
    );

describe("withAuth guard", () => {
  it("extracts Bearer token and returns session on success", async () => {
    const mockAuthService = makeAuthServiceMock();
    mockAuthService.verifyToken.mockReturnValue(Effect.succeed(mockSession));

    const TestLayer = Layer.succeed(AuthService, mockAuthService);
    const runtime = ManagedRuntime.make(TestLayer);

    const handler = makeHandlerMock();

    const request = new Request("http://localhost/api/auth/me", {
      headers: { Authorization: "Bearer valid-token" },
    });

    const guard = withAuth(handler);
    const result = await runtime.runPromise(guard(request));

    expect(result.status).toBe(200);
    const body: unknown = await result.json();
    expect(body).toMatchObject({ userId: "user-1" });
    expect(mockAuthService.verifyToken).toHaveBeenCalledWith("valid-token");
    expect(handler).toHaveBeenCalledWith(mockSession);
  });

  it("returns 401 when no token is present", async () => {
    const mockAuthService = makeAuthServiceMock();

    const TestLayer = Layer.succeed(AuthService, mockAuthService);
    const runtime = ManagedRuntime.make(TestLayer);

    const handler = makeHandlerMock();
    const request = new Request("http://localhost/api/auth/me");
    // No Authorization header

    const guard = withAuth(handler);
    const result = await runtime.runPromise(guard(request));

    expect(result.status).toBe(401);
    const body: unknown = await result.json();
    expect(body).toMatchObject({ error: "Unauthorized" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 401 when token is expired", async () => {
    const mockAuthService = makeAuthServiceMock();
    mockAuthService.verifyToken.mockReturnValue(Effect.fail(new TokenExpired()));

    const TestLayer = Layer.succeed(AuthService, mockAuthService);
    const runtime = ManagedRuntime.make(TestLayer);

    const handler = makeHandlerMock();
    const request = new Request("http://localhost/api/auth/me", {
      headers: { Authorization: "Bearer expired-token" },
    });

    const guard = withAuth(handler);
    const result = await runtime.runPromise(guard(request));

    expect(result.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("passes a typed status error through instead of masking it as 500", async () => {
    const mockAuthService = makeAuthServiceMock();
    mockAuthService.verifyToken.mockReturnValue(Effect.succeed(mockSession));

    const TestLayer = Layer.succeed(AuthService, mockAuthService);
    const runtime = ManagedRuntime.make(TestLayer);

    const httpError = {
      status: 404,
      message: "Credential not found",
      code: "NOT_FOUND",
      retryable: false,
    };
    const handler = vi
      .fn<(session: Session) => Effect.Effect<Response, typeof httpError>>()
      .mockReturnValue(Effect.fail(httpError));

    const request = new Request("http://localhost/api/keys/cred-1", {
      headers: { Authorization: "Bearer valid-token" },
    });

    const guard = withAuth(handler);
    const result = await runtime.runPromise(guard(request));

    expect(result.status).toBe(404);
    const body: unknown = await result.json();
    expect(body).toMatchObject({ error: "Credential not found", code: "NOT_FOUND" });
  });

  it("returns 500 when the handler dies", async () => {
    const mockAuthService = makeAuthServiceMock();
    mockAuthService.verifyToken.mockReturnValue(Effect.succeed(mockSession));

    const TestLayer = Layer.succeed(AuthService, mockAuthService);
    const runtime = ManagedRuntime.make(TestLayer);

    const handler = vi
      .fn<(session: Session) => Effect.Effect<Response>>()
      .mockReturnValue(Effect.die(new Error("boom")));

    const request = new Request("http://localhost/api/auth/me", {
      headers: { Authorization: "Bearer valid-token" },
    });

    const guard = withAuth(handler);
    const result = await runtime.runPromise(guard(request));

    expect(result.status).toBe(500);
    const body: unknown = await result.json();
    expect(body).toMatchObject({ error: "Internal error" });
  });

  it("extracts token from cookie when no Authorization header", async () => {
    const mockAuthService = makeAuthServiceMock();
    mockAuthService.verifyToken.mockReturnValue(Effect.succeed(mockSession));

    const TestLayer = Layer.succeed(AuthService, mockAuthService);
    const runtime = ManagedRuntime.make(TestLayer);

    const handler = vi
      .fn<(session: Session) => Effect.Effect<Response>>()
      .mockImplementation(() => Effect.succeed(new Response("{}", { status: 200 })));

    const request = new Request("http://localhost/api/auth/me", {
      headers: { cookie: "access_token=cookie-token; other=value" },
    });

    const guard = withAuth(handler);
    await runtime.runPromise(guard(request));

    expect(mockAuthService.verifyToken).toHaveBeenCalledWith("cookie-token");
  });
});
