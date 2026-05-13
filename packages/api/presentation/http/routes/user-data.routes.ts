import { Effect } from "effect";
import { UserDataServices } from "../../../application/user-data/contracts";

type HttpError = {
  readonly status: number;
  readonly message: string;
};

type UserDataHttpService = {
  readonly getClearinghouseState: (typeof UserDataServices.Service)["getClearinghouseState"];
  readonly getSpotClearinghouseState: (typeof UserDataServices.Service)["getSpotClearinghouseState"];
  readonly getOpenOrders: (typeof UserDataServices.Service)["getOpenOrders"];
  readonly getFrontendOpenOrders: (typeof UserDataServices.Service)["getFrontendOpenOrders"];
  readonly getMeta: (typeof UserDataServices.Service)["getMeta"];
  readonly getHistoricalOrders: (typeof UserDataServices.Service)["getHistoricalOrders"];
  readonly getUserFills: (typeof UserDataServices.Service)["getUserFills"];
};

type RouteHandler = (
  request: Request,
  url: URL,
  userData: UserDataHttpService
) => Effect.Effect<Response, HttpError>;

type BuildUserDataRoutesParams = {
  readonly json: (body: unknown, status?: number, headers?: Record<string, string>) => Response;
  readonly mapServiceError: (error: unknown) => HttpError;
};

export const buildUserDataRoutes = ({
  json,
  mapServiceError,
}: BuildUserDataRoutesParams): Array<{
  method: string;
  path: string;
  handler: RouteHandler;
}> => [
  {
    method: "GET",
    path: "/api/user/clearinghouse-state",
    handler: (_request, _url, userData) =>
      Effect.gen(function* () {
        const payload = yield* userData
          .getClearinghouseState()
          .pipe(Effect.mapError(mapServiceError));
        return json({ data: payload });
      }),
  },
  {
    method: "GET",
    path: "/api/user/spot-clearinghouse-state",
    handler: (_request, _url, userData) =>
      Effect.gen(function* () {
        const payload = yield* userData
          .getSpotClearinghouseState()
          .pipe(Effect.mapError(mapServiceError));
        return json({ data: payload });
      }),
  },
  {
    method: "GET",
    path: "/api/user/open-orders",
    handler: (_request, _url, userData) =>
      Effect.gen(function* () {
        const payload = yield* userData.getOpenOrders().pipe(Effect.mapError(mapServiceError));
        return json({ data: payload });
      }),
  },
  {
    method: "GET",
    path: "/api/user/frontend-open-orders",
    handler: (_request, _url, userData) =>
      Effect.gen(function* () {
        const payload = yield* userData
          .getFrontendOpenOrders()
          .pipe(Effect.mapError(mapServiceError));
        return json({ data: payload });
      }),
  },
  {
    method: "GET",
    path: "/api/user/meta",
    handler: (_request, _url, userData) =>
      Effect.gen(function* () {
        const payload = yield* userData.getMeta().pipe(Effect.mapError(mapServiceError));
        return json({ data: payload });
      }),
  },
  {
    method: "GET",
    path: "/api/user/historical-orders",
    handler: (_request, _url, userData) =>
      Effect.gen(function* () {
        const payload = yield* userData
          .getHistoricalOrders()
          .pipe(Effect.mapError(mapServiceError));
        return json({ data: payload });
      }),
  },
  {
    method: "GET",
    path: "/api/user/fills",
    handler: (_request, _url, userData) =>
      Effect.gen(function* () {
        const payload = yield* userData.getUserFills().pipe(Effect.mapError(mapServiceError));
        return json({ data: payload });
      }),
  },
];
