import { Effect } from "effect";
import { ExchangeAccountRepo, ExchangeCredentialRepo } from "@0xsignal/auth";
import type { CredentialVerifier } from "../../integrations/hyperliquid/data-sources/credential-verifier";
import type { HttpError } from "../../platform/http/error-response";
import { buildWalletRoutes } from "../wallets";
import { buildKeyRoutes } from "../keys";

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
