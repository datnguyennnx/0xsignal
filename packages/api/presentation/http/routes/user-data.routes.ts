import { Effect } from "effect";
import { UserDataService } from "../../../application/user-data/contracts";

type HttpError = {
  readonly status: number;
  readonly message: string;
};

type UserDataHttpService = {
  readonly getClearinghouseState: (typeof UserDataService.Service)["getClearinghouseState"];
  readonly getSpotClearinghouseState: (typeof UserDataService.Service)["getSpotClearinghouseState"];
  readonly getOpenOrders: (typeof UserDataService.Service)["getOpenOrders"];
  readonly getFrontendOpenOrders: (typeof UserDataService.Service)["getFrontendOpenOrders"];
  readonly getMeta: (typeof UserDataService.Service)["getMeta"];
  readonly getHistoricalOrders: (typeof UserDataService.Service)["getHistoricalOrders"];
  readonly getUserFills: (typeof UserDataService.Service)["getUserFills"];
  readonly getPortfolio: (typeof UserDataService.Service)["getPortfolio"];
  readonly getUserVaultEquities: (typeof UserDataService.Service)["getUserVaultEquities"];
  readonly getUserFunding: (typeof UserDataService.Service)["getUserFunding"];
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

const requireWalletAddress = (url: URL): Effect.Effect<string, HttpError> => {
  const walletAddress = url.searchParams.get("walletAddress");
  if (!walletAddress) {
    return Effect.fail({
      status: 400,
      message: "walletAddress query parameter is required",
    } as HttpError);
  }
  return Effect.succeed(walletAddress);
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
    handler: (_request, url, userData) =>
      Effect.gen(function* () {
        const walletAddress = yield* requireWalletAddress(url);
        const payload = yield* userData
          .getClearinghouseState(walletAddress)
          .pipe(Effect.mapError(mapServiceError));
        return json({ data: payload });
      }),
  },
  {
    method: "GET",
    path: "/api/user/spot-clearinghouse-state",
    handler: (_request, url, userData) =>
      Effect.gen(function* () {
        const walletAddress = yield* requireWalletAddress(url);
        const payload = yield* userData
          .getSpotClearinghouseState(walletAddress)
          .pipe(Effect.mapError(mapServiceError));
        return json({ data: payload });
      }),
  },
  {
    method: "GET",
    path: "/api/user/open-orders",
    handler: (_request, url, userData) =>
      Effect.gen(function* () {
        const walletAddress = yield* requireWalletAddress(url);
        const payload = yield* userData
          .getOpenOrders(walletAddress)
          .pipe(Effect.mapError(mapServiceError));
        return json({ data: payload });
      }),
  },
  {
    method: "GET",
    path: "/api/user/frontend-open-orders",
    handler: (_request, url, userData) =>
      Effect.gen(function* () {
        const walletAddress = yield* requireWalletAddress(url);
        const payload = yield* userData
          .getFrontendOpenOrders(walletAddress)
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
    handler: (_request, url, userData) =>
      Effect.gen(function* () {
        const walletAddress = yield* requireWalletAddress(url);
        const payload = yield* userData
          .getHistoricalOrders(walletAddress)
          .pipe(Effect.mapError(mapServiceError));
        return json({ data: payload });
      }),
  },
  {
    method: "GET",
    path: "/api/user/fills",
    handler: (_request, url, userData) =>
      Effect.gen(function* () {
        const walletAddress = yield* requireWalletAddress(url);
        const payload = yield* userData
          .getUserFills(walletAddress)
          .pipe(Effect.mapError(mapServiceError));
        return json({ data: payload });
      }),
  },
  {
    method: "GET",
    path: "/api/user/portfolio",
    handler: (_request, url, userData) =>
      Effect.gen(function* () {
        const walletAddress = yield* requireWalletAddress(url);
        const payload = yield* userData
          .getPortfolio(walletAddress)
          .pipe(Effect.mapError(mapServiceError));
        return json({ data: payload });
      }),
  },
  {
    method: "GET",
    path: "/api/user/vault-equities",
    handler: (_request, url, userData) =>
      Effect.gen(function* () {
        const walletAddress = yield* requireWalletAddress(url);
        const payload = yield* userData
          .getUserVaultEquities(walletAddress)
          .pipe(Effect.mapError(mapServiceError));
        return json({ data: payload });
      }),
  },
  {
    method: "GET",
    path: "/api/user/funding",
    handler: (_request, url, userData) =>
      Effect.gen(function* () {
        const walletAddress = yield* requireWalletAddress(url);
        const startTime = url.searchParams.get("startTime");
        const endTime = url.searchParams.get("endTime");
        const payload = yield* userData
          .getUserFunding(
            walletAddress,
            startTime ? Number(startTime) : undefined,
            endTime ? Number(endTime) : undefined
          )
          .pipe(Effect.mapError(mapServiceError));
        return json({ data: payload });
      }),
  },
];
