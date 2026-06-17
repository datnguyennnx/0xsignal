import { Effect } from "effect";
import { ExchangeAccountRepo, ExchangeCredentialRepo } from "@0xsignal/auth";
import { HyperliquidClient } from "../../../application/hyperliquid/contracts";
import { buildWalletRoutes } from "./wallets.routes";
import { buildKeyRoutes } from "./keys.routes";

type HttpError = {
  readonly status: number;
  readonly message: string;
  readonly code?: string;
};

type AccountRepoService = typeof ExchangeAccountRepo.Service;
type CredentialRepoService = typeof ExchangeCredentialRepo.Service;

type CredentialRouteHandler = (
  request: Request,
  url: URL,
  accountRepo: AccountRepoService,
  credentialRepo: CredentialRepoService,
  userId?: string,
) => Effect.Effect<Response, HttpError, HyperliquidClient>;

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
}> => [
  ...buildWalletRoutes({ json, mapServiceError }).map((route) => ({
    method: route.method,
    path: route.path,
    handler: route.handler as CredentialRouteHandler,
  })),
  ...buildKeyRoutes({ json, mapServiceError }).map((route) => ({
    method: route.method,
    path: route.path,
    handler: route.handler as CredentialRouteHandler,
  })),
];
