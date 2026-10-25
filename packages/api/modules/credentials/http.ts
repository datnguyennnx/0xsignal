import { Effect } from "effect";
import type { HttpError } from "../../platform/http/error-response";
import { buildWalletRoutes, type WalletRouteDeps } from "../wallets";

type CredentialRouteHandler = (
  request: Request,
  url: URL,
  deps: WalletRouteDeps,
  userId?: string,
) => Effect.Effect<Response, HttpError>;

type BuildCredentialRoutesParams = {
  readonly json: (body: unknown, status?: number, headers?: Record<string, string>) => Response;
  readonly mapServiceError: (error: unknown) => HttpError;
};

export const buildCredentialRoutes = ({
  json,
  mapServiceError,
}: BuildCredentialRoutesParams): Array<{
  method: string;
  path: string;
  handler: CredentialRouteHandler;
}> =>
  buildWalletRoutes({ json, mapServiceError }).map((route) => ({
    method: route.method,
    path: route.path,
    handler: route.handler,
  }));
