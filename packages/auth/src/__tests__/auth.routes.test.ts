import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ConfigProvider, Effect, Layer, Logger, ManagedRuntime } from "effect";
import { AuthService } from "../application/auth.service";
import {
  buildAuthRoutes,
  INSECURE_COOKIES_WARNING,
  isInsecureCookiesEnabled,
} from "../presentation/auth.routes";

type AuthServiceShape = (typeof AuthService)["Service"];

const mockAuthService = {
  getAuthorizationUrl: vi.fn<AuthServiceShape["getAuthorizationUrl"]>(),
  handleCallback: vi.fn<AuthServiceShape["handleCallback"]>(),
  exchangeCode: vi.fn<AuthServiceShape["exchangeCode"]>(),
  verifyToken: vi.fn<AuthServiceShape["verifyToken"]>(),
  refreshTokens: vi.fn<AuthServiceShape["refreshTokens"]>(),
  logout: vi.fn<AuthServiceShape["logout"]>(),
};

const TestLayer = Layer.succeed(AuthService, mockAuthService);
const runtime = ManagedRuntime.make(TestLayer);

const originalFrontendUrl = process.env.FRONTEND_URL;
const originalInsecureCookies = process.env.INSECURE_COOKIES;

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function requireRoute(routes: ReturnType<typeof buildAuthRoutes>, path: string) {
  const route = routes.find((candidate) => candidate.path === path);
  if (route === undefined) throw new Error(`missing route: ${path}`);
  return route;
}

function setCookieOf(response: Response): string {
  return response.headers.get("Set-Cookie") ?? "";
}

function provideCurrentEnv<A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> {
  return effect.pipe(
    Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv()),
  );
}

function postTokenRequest(): Request {
  return new Request("http://localhost/api/auth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: "one-time-code-123" }),
  });
}

describe("auth routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.INSECURE_COOKIES;
    process.env.FRONTEND_URL = "https://app.example.com";
  });

  afterEach(() => {
    restoreEnv("FRONTEND_URL", originalFrontendUrl);
    restoreEnv("INSECURE_COOKIES", originalInsecureCookies);
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
    const body: unknown = await result.json();
    expect(body).toMatchObject({ error: "Invalid provider" });
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
    const body: unknown = await result.json();
    expect(body).toMatchObject({ error: "Missing required parameters" });
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
    const body: unknown = await result.json();
    expect(body).toMatchObject({ accessToken: "access-123" });
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
    const body: unknown = await result.json();
    expect(body).toMatchObject({ accessToken: "access-789" });
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

  it("issues a Secure, SameSite refresh cookie whenever the insecure flag is off", async () => {
    mockAuthService.exchangeCode.mockReturnValue(
      Effect.succeed({
        accessToken: "access-123",
        refreshToken: "refresh-456",
        tokenType: "Bearer",
        expiresIn: 900,
      }),
    );

    const routes = buildAuthRoutes();
    const tokenRoute = requireRoute(routes, "/api/auth/token");
    const result = await runtime.runPromise(
      tokenRoute.handler(postTokenRequest()).pipe(provideCurrentEnv),
    );
    const cookie = setCookieOf(result);

    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Path=/api/auth");
  });

  it("only drops Secure with the explicit flag, and warns when it does", async () => {
    process.env.INSECURE_COOKIES = "true";
    mockAuthService.exchangeCode.mockReturnValue(
      Effect.succeed({
        accessToken: "access-123",
        refreshToken: "refresh-456",
        tokenType: "Bearer",
        expiresIn: 900,
      }),
    );

    const logs: Array<{ level: string; message: string }> = [];
    const sink = Logger.make<ReadonlyArray<string>, void>(({ logLevel, message }) => {
      logs.push({ level: logLevel, message: message.join(" ") });
    });

    const routes = buildAuthRoutes();
    const tokenRoute = requireRoute(routes, "/api/auth/token");
    const result = await runtime.runPromise(
      tokenRoute.handler(postTokenRequest()).pipe(provideCurrentEnv, Effect.withLogger(sink)),
    );
    const cookie = setCookieOf(result);

    expect(cookie).not.toContain("Secure");
    expect(cookie).toContain("SameSite=Strict");
    expect(logs.some((entry) => entry.level === "Warn")).toBe(true);
    expect(logs.some((entry) => entry.message.includes(INSECURE_COOKIES_WARNING))).toBe(true);
  });

  it("recognizes only explicit truthy env values", () => {
    expect(isInsecureCookiesEnabled("true")).toBe(true);
    expect(isInsecureCookiesEnabled(" TRUE ")).toBe(true);
    expect(isInsecureCookiesEnabled("1")).toBe(true);
    expect(isInsecureCookiesEnabled("false")).toBe(false);
    expect(isInsecureCookiesEnabled("")).toBe(false);
  });
});
