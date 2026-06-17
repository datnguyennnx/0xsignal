import { Effect, Redacted, Schema } from "effect";
import { ExchangeAccountRepo, ExchangeCredentialRepo } from "@0xsignal/auth";
import { HyperliquidClient } from "../../../application/hyperliquid/contracts";
import { asHttpError, type HttpError } from "../error-response";
import { CreateKeySchema } from "./credentials.schemas";

type AccountRepoService = typeof ExchangeAccountRepo.Service;
type CredentialRepoService = typeof ExchangeCredentialRepo.Service;

type KeyRouteHandler = (
  request: Request,
  url: URL,
  accountRepo: AccountRepoService,
  credentialRepo: CredentialRepoService,
  userId?: string,
) => Effect.Effect<Response, HttpError, HyperliquidClient>;

type BuildKeyRoutesParams = {
  readonly json: (body: unknown, status?: number, headers?: Record<string, string>) => Response;
  readonly mapServiceError: (error: unknown) => HttpError;
};

export const buildKeyRoutes = ({
  json,
  mapServiceError,
}: BuildKeyRoutesParams): Array<{
  method: string;
  path: string;
  handler: KeyRouteHandler;
}> => [
  // POST /api/wallets/:accountId/keys
  {
    method: "POST",
    path: "/api/wallets/:accountId/keys",
    handler: (request, url, _accountRepo, credentialRepo, userId) =>
      Effect.gen(function* () {
        if (!userId) {
          return yield* Effect.fail(asHttpError(401, "Authentication required"));
        }

        const accountId = url.pathname.split("/")[3]; // /api/wallets/:accountId/keys

        const raw = yield* Effect.tryPromise({
          try: () => request.json(),
          catch: () => asHttpError(400, "Invalid request body"),
        });

        const { agentAddress, agentPrivateKey, label } = yield* Schema.decodeUnknownEffect(
          CreateKeySchema,
        )(raw).pipe(
          Effect.mapError((err) => asHttpError(400, `Invalid request body: ${err.message}`)),
        );

        // agentPrivateKey is sensitive — wrap in Redacted before passing to repo
        const agentKeyRedacted = Redacted.make(agentPrivateKey);
        const credential = yield* credentialRepo
          .create({
            userId,
            accountId,
            credentialSubtype: "agent",
            agentAddress,
            agentKey: agentKeyRedacted,
            label,
          })
          .pipe(
            Effect.catchTag("AccountNotFound", () =>
              Effect.fail(asHttpError(404, "Wallet not found")),
            ),
            Effect.catchTag("DuplicateLabel", (e) =>
              Effect.fail(asHttpError(409, `Duplicate label: "${e.label}"`)),
            ),
            Effect.catchTag("EncryptionFailed", () =>
              Effect.fail(asHttpError(500, "Failed to encrypt credential key")),
            ),
            Effect.mapError(mapServiceError),
          );

        return json({
          data: {
            credentialId: credential.id,
            agentAddress: credential.agentAddress,
            isVerified: credential.isVerified,
          },
        });
      }),
  },

  // GET /api/wallets/:accountId/keys
  {
    method: "GET",
    path: "/api/wallets/:accountId/keys",
    handler: (_request, url, _accountRepo, credentialRepo, userId) =>
      Effect.gen(function* () {
        if (!userId) {
          return yield* Effect.fail(asHttpError(401, "Authentication required"));
        }

        const accountId = url.pathname.split("/")[3]; // /api/wallets/:accountId/keys

        // getActiveForAccount raises CredentialNotFound when none exists
        // we convert that to an empty array
        const maybeCredential = yield* credentialRepo
          .getActiveForAccount(accountId, userId, "agent")
          .pipe(
            Effect.catchTag("CredentialNotFound", () => Effect.succeed(null as never)),
            Effect.mapError(mapServiceError),
          );

        if (!maybeCredential) {
          return json({ data: [] });
        }

        // NEVER return enc_agent_key or enc_eoa_key in any HTTP response
        const { encAgentKey: _k1, encEoaKey: _k2, ...safe } = maybeCredential;

        return json({
          data: [
            {
              id: safe.id,
              label: safe.label,
              agentAddress: safe.agentAddress,
              permissions: safe.permissions,
              isVerified: safe.isVerified,
              verifiedAt: safe.verifiedAt,
              createdAt: safe.createdAt,
              expiresAt: safe.expiresAt,
              isRevoked: safe.isRevoked,
            },
          ],
        });
      }),
  },

  // POST /api/wallets/:accountId/keys/:credentialId/verify
  {
    method: "POST",
    path: "/api/wallets/:accountId/keys/:credentialId/verify",
    handler: (_request, url, _accountRepo, credentialRepo, userId) =>
      Effect.gen(function* () {
        if (!userId) {
          return yield* Effect.fail(asHttpError(401, "Authentication required"));
        }

        const pathParts = url.pathname.split("/");
        const credentialId = pathParts[5]; // /api/wallets/:aid/keys/:cid/verify
        const accountId = pathParts[3]; // /api/wallets/:aid/keys/:cid/verify

        // Step 1: Get decrypted credential (skips is_verified check)
        const decrypted = yield* credentialRepo.getForVerification(credentialId, userId).pipe(
          Effect.catchTag("CredentialNotFound", () =>
            Effect.fail(asHttpError(404, "Credential not found")),
          ),
          Effect.catchTag("CredentialRevoked", () =>
            Effect.fail(asHttpError(403, "Credential has been revoked")),
          ),
          Effect.catchTag("CredentialExpired", () =>
            Effect.fail(asHttpError(403, "Credential has expired")),
          ),
          Effect.catchTag("EncryptionFailed", () =>
            Effect.fail(asHttpError(500, "Failed to decrypt credential")),
          ),
          Effect.mapError(mapServiceError),
        );

        // Step 2: Call Hyperliquid Info API to verify the credential exists
        const hlClient = yield* HyperliquidClient;
        const hlState = yield* Effect.tryPromise({
          try: () => hlClient.info.clearinghouseState({ user: decrypted.agentAddress }),
          catch: (e) => {
            const msg = e instanceof Error ? e.message : "Unknown error from Hyperliquid API";
            return asHttpError(422, `Verification failed: ${msg}`);
          },
        }).pipe(Effect.mapError(mapServiceError));

        if (!hlState) {
          return yield* Effect.fail(
            asHttpError(422, "Verification failed: no account state returned from Hyperliquid"),
          );
        }

        // Step 3: Mark as verified
        yield* credentialRepo.setVerified(credentialId, userId).pipe(
          Effect.catchTag("CredentialNotFound", () =>
            Effect.fail(asHttpError(404, "Credential not found after verification")),
          ),
          Effect.mapError(mapServiceError),
        );

        // Step 4: Audit log
        yield* credentialRepo.recordAuditEvent("credential.test", {
          userId,
          accountId,
          credentialId,
          context: { exchange: "hyperliquid", result: "verified" },
        });

        // Step 5: Return success
        return json({
          data: {
            isVerified: true,
            verifiedAt: new Date().toISOString(),
          },
        });
      }),
  },

  // DELETE /api/wallets/:accountId/keys/:credentialId
  {
    method: "DELETE",
    path: "/api/wallets/:accountId/keys/:credentialId",
    handler: (_request, url, _accountRepo, credentialRepo, userId) =>
      Effect.gen(function* () {
        if (!userId) {
          return yield* Effect.fail(asHttpError(401, "Authentication required"));
        }

        const pathParts = url.pathname.split("/");
        const credentialId = pathParts[5]; // /api/wallets/:aid/keys/:cid

        yield* credentialRepo.revoke(credentialId, "user_initiated", userId).pipe(
          Effect.catchTag("CredentialNotFound", () =>
            Effect.fail(asHttpError(404, "Credential not found")),
          ),
          Effect.mapError(mapServiceError),
        );

        return new Response(null, { status: 204 });
      }),
  },
];
