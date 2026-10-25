import { Effect, Schema } from "effect";
import type { UserDataService } from "./index";
import type { HttpError } from "../../platform/http/error-response";
import { EVM_ADDRESS_RE } from "../../shared/schema";
import { parseQuery } from "../../platform/http/utils/param-parsers";

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
  userData: UserDataHttpService,
) => Effect.Effect<Response, HttpError>;

type BuildUserDataRoutesParams = {
  readonly json: (body: unknown, status?: number, headers?: Record<string, string>) => Response;
  readonly mapServiceError: (error: unknown) => HttpError;
};

const walletAddressFromQuery = Schema.String.pipe(
  Schema.check(Schema.isPattern(EVM_ADDRESS_RE, { message: "expected 0x-prefixed 40-char hex" })),
  Schema.annotateKey({ messageMissingKey: "walletAddress query parameter is required" }),
);

const userDataWalletQuery = Schema.Struct({
  walletAddress: walletAddressFromQuery,
});

const userDataFundingQuery = Schema.Struct({
  walletAddress: walletAddressFromQuery,
  startTime: Schema.optionalKey(Schema.FiniteFromString),
  endTime: Schema.optionalKey(Schema.FiniteFromString),
});

const requireWalletAddress = (url: URL): Effect.Effect<string, HttpError> =>
  parseQuery(url.searchParams, userDataWalletQuery).pipe(
    Effect.map((query) => query.walletAddress),
  );

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
        const query = yield* parseQuery(url.searchParams, userDataFundingQuery);
        const payload = yield* userData
          .getUserFunding(query.walletAddress, query.startTime, query.endTime)
          .pipe(Effect.mapError(mapServiceError));
        return json({ data: payload });
      }),
  },
];
