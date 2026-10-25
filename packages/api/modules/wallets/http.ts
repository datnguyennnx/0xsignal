import { Effect, Schema } from "effect";
import { ExchangeAccountRepo, ExchangeCredentialRepo } from "@0xsignal/auth";
import type { CredentialVerifier } from "../../integrations/hyperliquid/data-sources/credential-verifier";
import { asHttpError, type HttpError } from "../../platform/http/error-response";
import { requireUserId } from "../../platform/http/require-user";
import { CreateWalletSchema, validateWalletAddress } from "../../shared/credential-schema";

type AccountRepoService = typeof ExchangeAccountRepo.Service;
type CredentialRepoService = typeof ExchangeCredentialRepo.Service;

// userId is optional only to match CredentialHttpHandler; route-table gates every
// wallet route behind requireAuthCredentials, which always supplies the session user.
type WalletRouteHandler = (
  request: Request,
  url: URL,
  accountRepo: AccountRepoService,
  credentialRepo: CredentialRepoService,
  verifier: typeof CredentialVerifier.Service,
  userId?: string,
) => Effect.Effect<Response, HttpError>;

type BuildWalletRoutesParams = {
  readonly json: (body: unknown, status?: number, headers?: Record<string, string>) => Response;
  readonly mapServiceError: (error: unknown) => HttpError;
};

export const buildWalletRoutes = ({
  json,
  mapServiceError,
}: BuildWalletRoutesParams): Array<{
  method: string;
  path: string;
  handler: WalletRouteHandler;
}> => [
  // POST /api/wallets
  {
    method: "POST",
    path: "/api/wallets",
    handler: (request, _url, accountRepo, _credentialRepo, _hlClient, userId) =>
      Effect.gen(function* () {
        const uid = yield* requireUserId(userId);

        const raw: unknown = yield* Effect.tryPromise({
          try: () => request.json(),
          catch: () => asHttpError(400, "Invalid request body"),
        });

        const { exchangeSlug, walletAddress, label } = yield* Schema.decodeUnknownEffect(
          CreateWalletSchema,
        )(raw).pipe(
          Effect.mapError((err) => asHttpError(400, `Invalid request body: ${err.message}`)),
        );

        const validationErr = validateWalletAddress(walletAddress, exchangeSlug);
        if (validationErr !== null) {
          return yield* Effect.fail(asHttpError(400, validationErr));
        }

        const account = yield* accountRepo
          .create({
            userId: uid,
            exchangeSlug,
            nodeType: "wallet",
            walletAddress,
            label,
          })
          .pipe(
            Effect.catchTag("DuplicateLabel", (e) =>
              Effect.fail(asHttpError(409, `Duplicate label: "${e.label}"`)),
            ),
            Effect.mapError(mapServiceError),
          );

        return json({
          data: {
            accountId: account.id,
            walletAddress: account.walletAddress,
            isPrimary: account.isPrimary,
          },
        });
      }),
  },

  // GET /api/wallets
  {
    method: "GET",
    path: "/api/wallets",
    handler: (_request, url, accountRepo, _credentialRepo, _hlClient, userId) =>
      Effect.gen(function* () {
        const uid = yield* requireUserId(userId);

        const exchangeSlug = url.searchParams.get("exchangeSlug") ?? undefined;

        const accounts = yield* accountRepo.findByUserId(uid, exchangeSlug);

        return json({
          data: accounts.map(({ metadata: _omit, ...safe }) => safe),
        });
      }),
  },

  // DELETE /api/wallets/:accountId
  {
    method: "DELETE",
    path: "/api/wallets/:accountId",
    handler: (_request, url, accountRepo, _credentialRepo, _hlClient, userId) =>
      Effect.gen(function* () {
        const uid = yield* requireUserId(userId);

        const accountId = url.pathname.split("/")[3]; // /api/wallets/:accountId

        yield* accountRepo.deactivate(accountId, uid).pipe(
          Effect.catchTag("AccountNotFound", () =>
            Effect.fail(asHttpError(404, "Wallet not found")),
          ),
          Effect.mapError(mapServiceError),
        );

        return new Response(null, { status: 204 });
      }),
  },
];
