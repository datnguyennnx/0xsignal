import { Effect, Layer } from "effect";
import { HyperliquidClient } from "../../integrations/hyperliquid/data-sources/hyperliquid-client";
import { HyperliquidRateLimiter } from "../../integrations/hyperliquid/rate-limit";
import { INFO_WEIGHTS, UNLISTED_INFO_WEIGHT } from "../../integrations/hyperliquid/weights";
import { InternalError } from "../../shared/errors";
import type { AppError } from "../../shared/errors";
import { UserDataService } from "./index";

const callInfoApi = <A>(label: string, fn: () => Promise<A>): Effect.Effect<A, AppError> =>
  Effect.tryPromise({
    try: fn,
    catch: (cause) =>
      new InternalError({
        message: `${label} failed`,
        cause,
      }),
  });

export const userDataServiceLayer = Layer.effect(
  UserDataService,
  Effect.gen(function* () {
    const { info } = yield* HyperliquidClient;
    const limiter = yield* HyperliquidRateLimiter;

    const infoCall = <A>(
      label: string,
      weight: number,
      fn: () => Promise<A>,
    ): Effect.Effect<A, AppError> =>
      limiter.acquire(weight).pipe(
        Effect.mapError(
          (error) =>
            new InternalError({ message: `${label} rate limited: ${error.message}`, cause: error }),
        ),
        Effect.flatMap(() => callInfoApi(label, fn)),
      );

    return UserDataService.of({
      getClearinghouseState: (walletAddress) =>
        infoCall("clearinghouseState", INFO_WEIGHTS.clearinghouseState, () =>
          info.clearinghouseState({ user: walletAddress }),
        ),

      getSpotClearinghouseState: (walletAddress) =>
        infoCall("spotClearinghouseState", INFO_WEIGHTS.spotClearinghouseState, () =>
          info.spotClearinghouseState({ user: walletAddress }),
        ),

      getFrontendOpenOrders: (walletAddress) =>
        infoCall("frontendOpenOrders", INFO_WEIGHTS.frontendOpenOrders, () =>
          info.frontendOpenOrders({ user: walletAddress }),
        ),

      getHistoricalOrders: (walletAddress) =>
        infoCall("historicalOrders", UNLISTED_INFO_WEIGHT, () =>
          info.historicalOrders({ user: walletAddress }),
        ),

      getUserFills: (walletAddress) =>
        infoCall("userFills", INFO_WEIGHTS.userFills, () =>
          info.userFills({ user: walletAddress }),
        ),

      getPortfolio: (walletAddress) =>
        infoCall("portfolio", UNLISTED_INFO_WEIGHT, () => info.portfolio({ user: walletAddress })),

      // The published table names `vaultEquities`, not `userVaultEquities`;
      // charge the unlisted flat estimate rather than borrow the 20 of another endpoint.
      getUserVaultEquities: (walletAddress) =>
        infoCall("userVaultEquities", UNLISTED_INFO_WEIGHT, () =>
          info.userVaultEquities({ user: walletAddress }),
        ),

      getUserFunding: (walletAddress, startTime?: number, endTime?: number) =>
        infoCall("userFunding", UNLISTED_INFO_WEIGHT, () => {
          const params: { user: string; startTime?: number; endTime?: number } = {
            user: walletAddress,
          };
          if (startTime !== undefined) params.startTime = startTime;
          if (endTime !== undefined) params.endTime = endTime;
          return info.userFunding(params);
        }),
    });
  }),
);
