import { Effect, Schema } from "effect";
import { ExchangeAccountRepo, ExchangeCredentialRepo } from "@0xsignal/auth";
import { CreateWalletSchema, validateWalletAddress } from "./credentials.schemas";

type HttpError = {
  readonly status: number;
  readonly message: string;
  readonly code?: string;
};

type AccountRepoService = typeof ExchangeAccountRepo.Service;
type CredentialRepoService = typeof ExchangeCredentialRepo.Service;

type WalletRouteHandler = (
  request: Request,
  url: URL,
  accountRepo: AccountRepoService,
  credentialRepo: CredentialRepoService,
  userId?: string,
) => Effect.Effect<Response, HttpError>;

type BuildWalletRoutesParams = {
  readonly json: (body: unknown, status?: number, headers?: Record<string, string>) => Response;
  readonly mapServiceError: (error: unknown) => HttpError;
};

const asHttpError = (status: number, message: string): HttpError => ({ status, message });

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
    handler: (request, _url, accountRepo, _credentialRepo, userId) =>
      Effect.gen(function* () {
        if (!userId) {
          return yield* Effect.fail(asHttpError(401, "Authentication required"));
        }

        const raw = yield* Effect.tryPromise({
          try: () => request.json(),
          catch: () => asHttpError(400, "Invalid request body"),
        });

        const { exchangeSlug, walletAddress, label } = yield* Schema.decodeUnknownEffect(
          CreateWalletSchema,
        )(raw).pipe(
          Effect.mapError((err) => asHttpError(400, `Invalid request body: ${err.message}`)),
        );

        const validationErr = validateWalletAddress(walletAddress, exchangeSlug);
        if (validationErr) {
          return yield* Effect.fail(asHttpError(400, validationErr));
        }

        const account = yield* accountRepo
          .create({
            userId,
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
    handler: (_request, url, accountRepo, _credentialRepo, userId) =>
      Effect.gen(function* () {
        if (!userId) {
          return yield* Effect.fail(asHttpError(401, "Authentication required"));
        }

        const exchangeSlug = url.searchParams.get("exchangeSlug") ?? undefined;

        const accounts = yield* accountRepo.findByUserId(userId, exchangeSlug);

        return json({
          data: accounts.map(({ metadata: _omit, ...safe }) => safe),
        });
      }),
  },

  // DELETE /api/wallets/:accountId
  {
    method: "DELETE",
    path: "/api/wallets/:accountId",
    handler: (_request, url, accountRepo, _credentialRepo, userId) =>
      Effect.gen(function* () {
        if (!userId) {
          return yield* Effect.fail(asHttpError(401, "Authentication required"));
        }

        const accountId = url.pathname.split("/")[3]; // /api/wallets/:accountId

        yield* accountRepo.deactivate(accountId, userId).pipe(
          Effect.catchTag("AccountNotFound", () =>
            Effect.fail(asHttpError(404, "Wallet not found")),
          ),
          Effect.mapError(mapServiceError),
        );

        return new Response(null, { status: 204 });
      }),
  },
];
