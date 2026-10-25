import { Clock, Context, Effect, Schema } from "effect";
import { AgentRegistrationRepo, ExchangeAccountRepo, type AgentRegistration } from "@0xsignal/auth";
import { asHttpError, type HttpError } from "../../platform/http/error-response";
import { requireUserId } from "../../platform/http/require-user";
import { CreateWalletSchema, validateWalletAddress } from "../../shared/credential-schema";

type AccountRepoService = typeof ExchangeAccountRepo.Service;
type AgentRegistrationRepoService = Context.Service.Shape<typeof AgentRegistrationRepo>;

// userId is optional only because the route table supplies the session user.
type WalletRouteHandler = (
  request: Request,
  url: URL,
  deps: WalletRouteDeps,
  userId?: string,
) => Effect.Effect<Response, HttpError>;

export type WalletRouteDeps = {
  readonly accountRepo: AccountRepoService;
  readonly agentRegistrationRepo: AgentRegistrationRepoService;
};

type BuildWalletRoutesParams = {
  readonly json: (body: unknown, status?: number, headers?: Record<string, string>) => Response;
  readonly mapServiceError: (error: unknown) => HttpError;
};

const AgentRegistrationStatusSchema = Schema.Literals(["active", "expired"]);

const AgentRegistrationItemSchema = Schema.Struct({
  agentAddress: Schema.String,
  label: Schema.optionalKey(Schema.String),
  expiresAt: Schema.optionalKey(Schema.String),
  isVerified: Schema.Boolean,
  createdAt: Schema.String,
  status: AgentRegistrationStatusSchema,
});

type AgentRegistrationItem = Schema.Schema.Type<typeof AgentRegistrationItemSchema>;

const statusFor = (
  expiresAt: string | undefined,
  nowMillis: number,
): AgentRegistrationItem["status"] => {
  if (expiresAt === undefined) return "active";
  const expiry = Date.parse(expiresAt);
  return Number.isFinite(expiry) && expiry <= nowMillis ? "expired" : "active";
};

const toItem = (registration: AgentRegistration, nowMillis: number): AgentRegistrationItem =>
  Schema.decodeUnknownSync(AgentRegistrationItemSchema)({
    agentAddress: registration.agentAddress,
    ...(registration.label !== undefined && { label: registration.label }),
    ...(registration.expiresAt !== undefined && { expiresAt: registration.expiresAt }),
    isVerified: registration.isVerified,
    createdAt: registration.createdAt,
    status: statusFor(registration.expiresAt, nowMillis),
  });

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
    handler: (request, _url, { accountRepo }, userId) =>
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
    handler: (_request, url, { accountRepo }, userId) =>
      Effect.gen(function* () {
        const uid = yield* requireUserId(userId);

        const exchangeSlug = url.searchParams.get("exchangeSlug") ?? undefined;

        const accounts = yield* accountRepo.findByUserId(uid, exchangeSlug);

        return json({
          data: accounts.map(({ metadata: _omit, ...safe }) => safe),
        });
      }),
  },

  // GET /api/wallets/agent-registrations
  {
    method: "GET",
    path: "/api/wallets/agent-registrations",
    handler: (_request, _url, { agentRegistrationRepo }, userId) =>
      Effect.gen(function* () {
        const uid = yield* requireUserId(userId);

        const nowMillis = yield* Clock.currentTimeMillis;
        const registrations = yield* agentRegistrationRepo.listByUserId(uid);

        return json({
          data: registrations.map((registration) => toItem(registration, nowMillis)),
        });
      }),
  },
];
