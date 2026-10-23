import { Effect } from "effect";
import { ExchangeAccountRepo, ExchangeCredentialRepo } from "@0xsignal/auth";
import type { CredentialVerifier } from "../../../application/hyperliquid/credential-verification";
import type { HttpError } from "../error-response";
import { buildWalletRoutes } from "./wallets.routes";
import { buildKeyRoutes } from "./keys.routes";

type AccountRepoService = typeof ExchangeAccountRepo.Service;
type CredentialRepoService = typeof ExchangeCredentialRepo.Service;

type CredentialRouteHandler = (
  request: Request,
  url: URL,
  accountRepo: AccountRepoService,
  credentialRepo: CredentialRepoService,
  verifier: typeof CredentialVerifier.Service,
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
}> => [
  ...buildWalletRoutes({ json, mapServiceError }).map((route) => ({
    method: route.method,
    path: route.path,
    handler: route.handler,
  })),
  ...buildKeyRoutes({ json, mapServiceError }).map((route) => ({
    method: route.method,
    path: route.path,
    handler: route.handler,
  })),
];
