import { Effect } from "effect";
import { ExchangeAccountRepo } from "@0xsignal/auth";
import type { HttpError } from "../../platform/http/error-response";
import { buildWalletRoutes } from "../wallets";

type AccountRepoService = typeof ExchangeAccountRepo.Service;

type CredentialRouteHandler = (
  request: Request,
  url: URL,
  accountRepo: AccountRepoService,
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
