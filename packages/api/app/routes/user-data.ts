import { Effect } from "effect";
import { ExchangeAccountRepo, withAuth } from "@0xsignal/auth";
import { UserDataService } from "../../modules/user-data";
import { buildUserDataRoutes, type WalletAuthorizer } from "../../modules/user-data/http";
import { asHttpError, json } from "../../platform/http/error-response";
import type { Route } from "../../platform/http/route-contracts";
import type { HttpRequestServices } from "../contracts";
import { withDefectGuard } from "../defect-guard";
import { mapServiceError } from "../error-mapping";

type AccountRepoService = typeof ExchangeAccountRepo.Service;

// The wallet must be one the authenticated user linked through exchange_accounts;
// a shared backend budget must never be spent on an address the caller does not own.
const makeWalletAuthorizer =
  (accountRepo: AccountRepoService, userId: string): WalletAuthorizer =>
  (walletAddress) =>
    accountRepo.findByUserId(userId).pipe(
      Effect.mapError(mapServiceError),
      Effect.flatMap((accounts) => {
        const requested = walletAddress.toLowerCase();
        const owned = accounts.some((account) => account.walletAddress.toLowerCase() === requested);
        return owned
          ? Effect.void
          : Effect.fail(
              asHttpError(
                403,
                "Forbidden: wallet does not belong to the authenticated user",
                "FORBIDDEN",
              ),
            );
      }),
    );

export const userDataRoutes: ReadonlyArray<Route<HttpRequestServices>> = buildUserDataRoutes({
  json,
  mapServiceError,
}).map((route) => ({
  method: route.method,
  path: route.path,
  handler: (request, url) =>
    withDefectGuard(
      Effect.gen(function* () {
        const userData = yield* UserDataService;
        const accountRepo = yield* ExchangeAccountRepo;
        return yield* withAuth((session) =>
          route.handler(request, url, userData, makeWalletAuthorizer(accountRepo, session.userId)),
        )(request);
      }),
    ),
}));
