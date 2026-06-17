import { describe, expect, it, vi, beforeEach } from "vitest";
import { Effect, Layer, ManagedRuntime } from "effect";
import { AuthService } from "../application/auth.service";
import { buildAuthRoutes } from "../presentation/auth.routes";

const mockAuthService = {
  getAuthorizationUrl: vi.fn(),
  handleCallback: vi.fn(),
  exchangeCode: vi.fn(),
  verifyToken: vi.fn(),
  refreshTokens: vi.fn(),
  logout: vi.fn(),
};

const TestLayer = Layer.succeed(AuthService, mockAuthService);
const runtime = ManagedRuntime.make(TestLayer);

describe("auth routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns redirect URL for GET /api/auth/:provider/login", async () => {
    mockAuthService.getAuthorizationUrl.mockReturnValue(
      Effect.succeed({ url: "https://accounts.google.com/o/oauth2/auth?state=xyz", state: "xyz" }),
    );

    const routes = buildAuthRoutes();
    const loginRoute = routes.find((r) => r.path === "/api/auth/:provider/login");
    expect(loginRoute).toBeDefined();

    const request = new Request("http://localhost/api/auth/google/login");
    const result = await runtime.runPromise(loginRoute!.handler(request));

    expect(result.status).toBe(302);
    expect(result.headers.get("Location")).toContain("accounts.google.com");
    expect(mockAuthService.getAuthorizationUrl).toHaveBeenCalledWith({ provider: "google" });
  });

  it("returns 400 for invalid provider", async () => {
    const routes = buildAuthRoutes();
    const loginRoute = routes.find((r) => r.path === "/api/auth/:provider/login");

    const request = new Request("http://localhost/api/auth/invalid/login");
    const result = await runtime.runPromise(loginRoute!.handler(request));

    expect(result.status).toBe(400);
    const body = await result.json();
    expect(body.error).toBe("Invalid provider");
  });

  it("handles callback and redirects with code", async () => {
    mockAuthService.handleCallback.mockReturnValue(
      Effect.succeed({
        code: "one-time-code-123",
      }),
    );

    const routes = buildAuthRoutes();
    const callbackRoute = routes.find((r) => r.path === "/api/auth/:provider/callback");

    const request = new Request("http://localhost/api/auth/google/callback?code=abc&state=xyz");
    const result = await runtime.runPromise(callbackRoute!.handler(request));

    expect(result.status).toBe(302);
    expect(result.headers.get("Location")).toContain("code=one-time-code-123");
    expect(mockAuthService.handleCallback).toHaveBeenCalledWith({
      provider: "google",
      code: "abc",
      state: "xyz",
    });
  });

  it("returns 400 for callback missing parameters", async () => {
    const routes = buildAuthRoutes();
    const callbackRoute = routes.find((r) => r.path === "/api/auth/:provider/callback");

    const request = new Request("http://localhost/api/auth/google/callback");
    const result = await runtime.runPromise(callbackRoute!.handler(request));

    expect(result.status).toBe(400);
    const body = await result.json();
    expect(body.error).toBe("Missing required parameters");
  });

  it("handles token exchange", async () => {
    mockAuthService.exchangeCode.mockReturnValue(
      Effect.succeed({
        accessToken: "access-123",
        refreshToken: "refresh-456",
        tokenType: "Bearer",
        expiresIn: 900,
      }),
    );

    const routes = buildAuthRoutes();
    const tokenRoute = routes.find((r) => r.path === "/api/auth/token");
    expect(tokenRoute).toBeDefined();

    const request = new Request("http://localhost/api/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "one-time-code-123" }),
    });
    const result = await runtime.runPromise(tokenRoute!.handler(request));

    expect(result.status).toBe(200);
    const body = await result.json();
    expect(body.accessToken).toBe("access-123");
    expect(result.headers.get("Set-Cookie")).toContain("refresh_token=refresh-456");
    expect(mockAuthService.exchangeCode).toHaveBeenCalledWith("one-time-code-123");
  });

  it("handles silent refresh", async () => {
    mockAuthService.refreshTokens.mockReturnValue(
      Effect.succeed({
        accessToken: "access-789",
        refreshToken: "refresh-rotated",
        tokenType: "Bearer",
        expiresIn: 900,
      }),
    );

    const routes = buildAuthRoutes();
    const refreshRoute = routes.find((r) => r.path === "/api/auth/refresh");
    expect(refreshRoute).toBeDefined();

    const request = new Request("http://localhost/api/auth/refresh", {
      method: "POST",
      headers: { Cookie: "refresh_token=refresh-456" },
    });
    const result = await runtime.runPromise(refreshRoute!.handler(request));

    expect(result.status).toBe(200);
    const body = await result.json();
    expect(body.accessToken).toBe("access-789");
    expect(result.headers.get("Set-Cookie")).toContain("refresh_token=refresh-rotated");
    expect(mockAuthService.refreshTokens).toHaveBeenCalledWith("refresh-456");
  });

  it("handles logout", async () => {
    mockAuthService.logout.mockReturnValue(Effect.void);

    const routes = buildAuthRoutes();
    const logoutRoute = routes.find((r) => r.path === "/api/auth/logout");

    const request = new Request("http://localhost/api/auth/logout", {
      method: "POST",
      headers: { Cookie: "refresh_token=refresh-token-123" },
    });
    const result = await runtime.runPromise(logoutRoute!.handler(request));

    expect(result.status).toBe(200);
    expect(result.headers.get("Set-Cookie")).toContain("refresh_token=;");
    expect(mockAuthService.logout).toHaveBeenCalledWith("refresh-token-123");
  });
});
