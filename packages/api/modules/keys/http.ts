import { Clock, Effect, Option, Redacted, Schema } from "effect";
import { ExchangeAccountRepo, ExchangeCredentialRepo } from "@0xsignal/auth";
import type { CredentialVerifier } from "../../integrations/hyperliquid/data-sources/credential-verifier";
import { asHttpError, type HttpError } from "../../platform/http/error-response";
import { requireUserId } from "../../platform/http/require-user";
import { CreateKeySchema } from "../../shared/credential-schema";

type AccountRepoService = typeof ExchangeAccountRepo.Service;
type CredentialRepoService = typeof ExchangeCredentialRepo.Service;

type KeyRouteHandler = (
  request: Request,
  url: URL,
  accountRepo: AccountRepoService,
  credentialRepo: CredentialRepoService,
  verifier: typeof CredentialVerifier.Service,
  userId?: string,
) => Effect.Effect<Response, HttpError>;

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
    handler: (request, url, _accountRepo, credentialRepo, _verifier, authUserId) =>
      Effect.gen(function* () {
        const userId = yield* requireUserId(authUserId);

        const accountId = url.pathname.split("/")[3]; // /api/wallets/:accountId/keys

        const raw: unknown = yield* Effect.tryPromise({
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
    handler: (_request, url, _accountRepo, credentialRepo, _verifier, authUserId) =>
      Effect.gen(function* () {
        const userId = yield* requireUserId(authUserId);

        const accountId = url.pathname.split("/")[3]; // /api/wallets/:accountId/keys

        // getActiveForAccount raises CredentialNotFound when none exists
        // we convert that to an empty array
        const maybeCredential = yield* credentialRepo
          .getActiveForAccount(accountId, userId, "agent")
          .pipe(
            Effect.map(Option.some),
            Effect.catchTag("CredentialNotFound", () => Effect.succeed(Option.none())),
            Effect.mapError(mapServiceError),
          );

        if (Option.isNone(maybeCredential)) {
          return json({ data: [] });
        }

        // NEVER return enc_agent_key or enc_eoa_key in any HTTP response
        const {
          id,
          label,
          agentAddress,
          permissions,
          isVerified,
          verifiedAt,
          createdAt,
          expiresAt,
          isRevoked,
        } = maybeCredential.value;

        return json({
          data: [
            {
              id,
              label,
              agentAddress,
              permissions,
              isVerified,
              verifiedAt,
              createdAt,
              expiresAt,
              isRevoked,
            },
          ],
        });
      }),
  },

  // POST /api/wallets/:accountId/keys/:credentialId/verify
  {
    method: "POST",
    path: "/api/wallets/:accountId/keys/:credentialId/verify",
    handler: (_request, url, _accountRepo, credentialRepo, verifier, authUserId) =>
      Effect.gen(function* () {
        const userId = yield* requireUserId(authUserId);

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

        // Step 2: Exchange-side existence check goes through the application
        // port, never through the SDK.
        const hasAccountState = yield* verifier
          .hasAccountState(decrypted.agentAddress)
          .pipe(
            Effect.mapError((error) => asHttpError(422, `Verification failed: ${error.message}`)),
          );

        if (!hasAccountState) {
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
        const verifiedAt = new Date(yield* Clock.currentTimeMillis).toISOString();
        return json({
          data: {
            isVerified: true,
            verifiedAt,
          },
        });
      }),
  },

  // DELETE /api/wallets/:accountId/keys/:credentialId
  {
    method: "DELETE",
    path: "/api/wallets/:accountId/keys/:credentialId",
    handler: (_request, url, _accountRepo, credentialRepo, _verifier, authUserId) =>
      Effect.gen(function* () {
        const userId = yield* requireUserId(authUserId);

        const pathParts = url.pathname.split("/");
        const credentialId = pathParts[5]; // /api/wallets/:aid/keys/:cid
        const accountId = pathParts[3]; // /api/wallets/:aid/keys/:cid

        // Ownership/scope is enforced by the repo; a mismatched accountId
        // surfaces as CredentialNotFound (404).
        yield* credentialRepo.revoke(credentialId, accountId, "user_initiated", userId).pipe(
          Effect.catchTag("CredentialNotFound", () =>
            Effect.fail(asHttpError(404, "Credential not found")),
          ),
          Effect.mapError(mapServiceError),
        );

        return new Response(null, { status: 204 });
      }),
  },
];
