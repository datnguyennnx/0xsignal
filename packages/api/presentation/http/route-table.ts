import { Cause, Effect } from "effect";
import {
  buildAuthRoutes,
  withAuth,
  ExchangeAccountRepo,
  ExchangeCredentialRepo,
} from "@0xsignal/auth";
import { asHttpError, mapServiceError } from "./error-response";
import {
  CredentialVerifier,
  type AuthRouteHandler,
  type CalendarHttpService,
  type CredentialHttpHandler,
  type ExchangeHttpService,
  type HealthHttpService,
  type MarketDataHttpService,
  type RouteEnvironment,
  type RouteHandler,
  type UserDataHttpService,
  type WhaleHttpService,
} from "./route-contracts";
import { buildMarketDataRoutes } from "./routes/market-data.routes";
import { buildCalendarRoutes } from "./routes/calendar.routes";
import { buildWhaleRoutes } from "./routes/whale.routes";
import { buildUserDataRoutes } from "./routes/user-data.routes";
import { buildExchangeRoutes } from "./routes/exchange.routes";
import { buildCredentialRoutes } from "./routes/credentials.routes";

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });

const internalErrorResponse = (): Response =>
  new Response(JSON.stringify({ error: "Internal server error" }), {
    status: 500,
    headers: { "Content-Type": "application/json" },
  });

// Typed failures keep their own status via the router; only defects and
// interruptions are indistinguishable from a crash and become 500s here.
const withDefectGuard = <E, R>(
  effect: Effect.Effect<Response, E, R>,
): Effect.Effect<Response, E, R> =>
  effect.pipe(
    Effect.catchCause((cause) =>
      Cause.hasDies(cause) || Cause.hasInterrupts(cause)
        ? Effect.succeed(internalErrorResponse())
        : Effect.failCause(cause),
    ),
  );

// Auth routes handle their own errors internally; always returns a Response
// Services (AuthService, ExchangeAccountRepo, ExchangeCredentialRepo) are
// provided by AppLayer at the top level.
const adaptAuthRoute =
  (handler: (request: Request) => Effect.Effect<Response, never, RouteEnvironment>): RouteHandler =>
  (request) =>
    withDefectGuard(handler(request));

// Requires a valid auth session before executing
const requireAuth =
  (routeHandler: AuthRouteHandler): RouteHandler =>
  (request, url, marketData, health, userData, exchange, calendar, whale) =>
    withDefectGuard(
      withAuth((session) =>
        routeHandler(
          request,
          url,
          marketData,
          health,
          userData,
          exchange,
          calendar,
          whale,
          session.userId,
        ),
      )(request),
    );

// Resolves the credential repositories before the auth session is checked, so
// the auth wrapper only has to supply AuthService.
const requireAuthCredentials =
  (handler: CredentialHttpHandler): RouteHandler =>
  (request, url, _marketData, _health, _userData, _exchange, _calendar, _whale) =>
    withDefectGuard(
      Effect.gen(function* () {
        const accountRepo = yield* ExchangeAccountRepo;
        const credentialRepo = yield* ExchangeCredentialRepo;
        const verifier = yield* CredentialVerifier;
        return yield* withAuth((session) =>
          handler(request, url, accountRepo, credentialRepo, verifier, session.userId),
        )(request);
      }),
    );

export const routes: Array<{ method: string; path: string; handler: RouteHandler }> = [
  {
    method: "GET",
    path: "/api/health",
    handler: (_request, _url, _marketData, health) =>
      health.check().pipe(
        Effect.map((body) => json({ data: body })),
        Effect.mapError((e) => asHttpError(e.status, e.message)),
      ),
  },
  ...buildMarketDataRoutes({
    json,
    mapServiceError,
  }).map((route) => ({
    method: route.method,
    path: route.path,
    handler: (request: Request, url: URL, marketData: MarketDataHttpService) =>
      route.handler(request, url, marketData),
  })),
  ...buildCalendarRoutes({
    json,
    mapServiceError,
  }).map((route) => ({
    method: route.method,
    path: route.path,
    handler: (
      request: Request,
      url: URL,
      _marketData: MarketDataHttpService,
      _health: HealthHttpService,
      _userData: UserDataHttpService,
      _exchange: ExchangeHttpService,
      calendar: CalendarHttpService | undefined,
    ) =>
      calendar === undefined
        ? Effect.succeed(json({ error: "Calendar service unavailable" }, 503))
        : route.handler(request, url, calendar),
  })),
  ...buildWhaleRoutes({
    json,
    mapServiceError,
  }).map((route) => ({
    method: route.method,
    path: route.path,
    handler: (
      request: Request,
      url: URL,
      _marketData: MarketDataHttpService,
      _health: HealthHttpService,
      _userData: UserDataHttpService,
      _exchange: ExchangeHttpService,
      _calendar: CalendarHttpService | undefined,
      whale: WhaleHttpService | undefined,
    ) =>
      whale === undefined
        ? Effect.succeed(json({ error: "Whale service unavailable" }, 503))
        : route.handler(request, url, whale),
  })),
  ...buildUserDataRoutes({
    json,
    mapServiceError,
  }).map((route) => ({
    method: route.method,
    path: route.path,
    handler: (
      request: Request,
      url: URL,
      _marketData: MarketDataHttpService,
      _health: HealthHttpService,
      userData: UserDataHttpService,
    ) => route.handler(request, url, userData),
  })),
  ...buildExchangeRoutes({
    json,
    mapServiceError,
  }).map((route) => ({
    method: route.method,
    path: route.path,
    handler: requireAuth(
      (
        request: Request,
        url: URL,
        _marketData: MarketDataHttpService,
        _health: HealthHttpService,
        _userData: UserDataHttpService,
        exchange: ExchangeHttpService,
        _calendar: CalendarHttpService | undefined,
        _whale: WhaleHttpService | undefined,
        userId?: string,
      ) => route.handler(request, url, exchange, userId),
    ),
  })),
  ...buildCredentialRoutes({
    json,
    mapServiceError,
  }).map((route) => ({
    method: route.method,
    path: route.path,
    handler: requireAuthCredentials(route.handler),
  })),
  ...buildAuthRoutes().map((route) => ({
    method: route.method,
    path: route.path,
    handler: adaptAuthRoute(route.handler),
  })),
];
