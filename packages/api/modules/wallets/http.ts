import { Effect, Schema } from "effect";
import { ExchangeAccountRepo } from "@0xsignal/auth";
import { asHttpError, type HttpError } from "../../platform/http/error-response";
import { requireUserId } from "../../platform/http/require-user";
import { CreateWalletSchema, validateWalletAddress } from "../../shared/credential-schema";

type AccountRepoService = typeof ExchangeAccountRepo.Service;

// userId is optional only because the route table supplies the session user.
type WalletRouteHandler = (
  request: Request,
  url: URL,
  accountRepo: AccountRepoService,
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
    handler: (request, _url, accountRepo, userId) =>
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
    handler: (_request, url, accountRepo, userId) =>
      Effect.gen(function* () {
        const uid = yield* requireUserId(userId);

        const exchangeSlug = url.searchParams.get("exchangeSlug") ?? undefined;

        const accounts = yield* accountRepo.findByUserId(uid, exchangeSlug);

        return json({
          data: accounts.map(({ metadata: _omit, ...safe }) => safe),
        });
      }),
  },
];
