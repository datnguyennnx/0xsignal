import { Clock, Context, Effect, Schema } from "effect";
import { recoverMessageAddress } from "viem";
import {
  AgentRegistrationRepo,
  ExchangeAccountRepo,
  WalletChallengeRepo,
  type AgentRegistration,
} from "@0xsignal/auth";
import { asHttpError, type HttpError } from "../../platform/http/error-response";
import { requireUserId } from "../../platform/http/require-user";
import {
  LinkWalletSchema,
  WalletChallengeRequestSchema,
  validateWalletAddress,
} from "../../shared/credential-schema";

type AccountRepoService = typeof ExchangeAccountRepo.Service;
type AgentRegistrationRepoService = Context.Service.Shape<typeof AgentRegistrationRepo>;
type ChallengeRepoService = Context.Service.Shape<typeof WalletChallengeRepo>;

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
  readonly challengeRepo: ChallengeRepoService;
};

type BuildWalletRoutesParams = {
  readonly json: (body: unknown, status?: number, headers?: Record<string, string>) => Response;
  readonly mapServiceError: (error: unknown) => HttpError;
};

// A challenge outlives a single signing prompt but not a session: five minutes.
const WALLET_CHALLENGE_TTL_MS = 5 * 60 * 1000;

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

const readJsonBody = (request: Request): Effect.Effect<unknown, HttpError> =>
  Effect.tryPromise({
    try: () => request.json(),
    catch: () => asHttpError(400, "Invalid request body"),
  });

const isHex = (value: string): value is `0x${string}` => /^0x[a-fA-F0-9]+$/.test(value);

// The message is the server-issued challenge text only; order signing never
// reaches this path because it goes through signTypedData instead.
const recoveredAddress = (message: string, signature: string): Effect.Effect<string, HttpError> => {
  if (!isHex(signature)) {
    return Effect.fail(asHttpError(400, "Invalid signature", "INVALID_SIGNATURE"));
  }
  return Effect.tryPromise({
    try: () => recoverMessageAddress({ message, signature }),
    catch: () => asHttpError(400, "Invalid signature", "INVALID_SIGNATURE"),
  });
};

const challengeMessage = (params: {
  readonly domain: string;
  readonly address: string;
  readonly nonce: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
}): string =>
  [
    "0xSignal wallet ownership verification",
    "",
    `Domain: ${params.domain}`,
    `Address: ${params.address}`,
    `Nonce: ${params.nonce}`,
    `Issued At: ${params.issuedAt}`,
    `Expiration Time: ${params.expiresAt}`,
  ].join("\n");

export const buildWalletRoutes = ({
  json,
  mapServiceError,
}: BuildWalletRoutesParams): Array<{
  method: string;
  path: string;
  handler: WalletRouteHandler;
}> => [
  // POST /api/wallets/challenge
  {
    method: "POST",
    path: "/api/wallets/challenge",
    handler: (request, url, { challengeRepo }, userId) =>
      Effect.gen(function* () {
        const uid = yield* requireUserId(userId);

        const raw = yield* readJsonBody(request);

        const { address } = yield* Schema.decodeUnknownEffect(WalletChallengeRequestSchema)(
          raw,
        ).pipe(Effect.mapError((err) => asHttpError(400, `Invalid request body: ${err.message}`)));

        const nowMillis = yield* Clock.currentTimeMillis;
        const expiresAtMillis = nowMillis + WALLET_CHALLENGE_TTL_MS;
        const nonce = crypto.randomUUID();
        const issuedAt = new Date(nowMillis).toISOString();
        const expiresAt = new Date(expiresAtMillis).toISOString();
        const message = challengeMessage({
          domain: url.host,
          address,
          nonce,
          issuedAt,
          expiresAt,
        });

        yield* challengeRepo
          .issue({
            userId: uid,
            walletAddress: address,
            nonce,
            message,
            expiresAt: new Date(expiresAtMillis),
          })
          .pipe(Effect.mapError(mapServiceError));

        return json({ data: { nonce, message, expiresAt } });
      }),
  },

  // POST /api/wallets
  {
    method: "POST",
    path: "/api/wallets",
    handler: (request, _url, { accountRepo, challengeRepo }, userId) =>
      Effect.gen(function* () {
        const uid = yield* requireUserId(userId);

        const raw = yield* readJsonBody(request);

        const { exchangeSlug, walletAddress, label, nonce, signature } =
          yield* Schema.decodeUnknownEffect(LinkWalletSchema)(raw).pipe(
            Effect.mapError((err) => asHttpError(400, `Invalid request body: ${err.message}`)),
          );

        const validationErr = validateWalletAddress(walletAddress, exchangeSlug);
        if (validationErr !== null) {
          return yield* Effect.fail(asHttpError(400, validationErr));
        }

        const challenge = yield* challengeRepo
          .findActive({ userId: uid, walletAddress, nonce })
          .pipe(Effect.mapError(mapServiceError));

        const recovered = yield* recoveredAddress(challenge.message, signature);
        if (recovered.toLowerCase() !== walletAddress.toLowerCase()) {
          return yield* Effect.fail(
            asHttpError(
              400,
              "Signature does not match the claimed wallet address",
              "SIGNATURE_ADDRESS_MISMATCH",
            ),
          );
        }

        // Consume only after the signature proves control; a replay then fails.
        yield* challengeRepo
          .consume({ userId: uid, walletAddress, nonce })
          .pipe(Effect.mapError(mapServiceError));

        const account = yield* accountRepo
          .verifyWallet({
            userId: uid,
            exchangeSlug,
            walletAddress,
            nonce,
            label,
          })
          .pipe(
            Effect.catchTag("DuplicateLabel", (e) =>
              Effect.fail(asHttpError(409, `Duplicate label: "${e.label}"`)),
            ),
            Effect.catchTag("WalletAddressClaimed", (e) =>
              Effect.fail(
                asHttpError(
                  409,
                  `Wallet address already linked to another account: ${e.walletAddress}`,
                  "WALLET_ALREADY_CLAIMED",
                ),
              ),
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
          data: accounts.map(({ metadata: _omit, verifiedAt, ...safe }) =>
            Object.assign({}, safe, { verified: verifiedAt !== undefined }),
          ),
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
