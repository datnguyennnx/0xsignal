import { Effect, Layer } from "effect";
import { HyperliquidClient } from "../../integrations/hyperliquid/data-sources/hyperliquid-client";
import {
  HyperliquidRateLimiter,
  INFO_REQUEST_WEIGHT,
} from "../../integrations/hyperliquid/rate-limit";
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

    const infoCall = <A>(label: string, fn: () => Promise<A>): Effect.Effect<A, AppError> =>
      limiter.acquire(INFO_REQUEST_WEIGHT).pipe(
        Effect.mapError(
          (error) =>
            new InternalError({ message: `${label} rate limited: ${error.message}`, cause: error }),
        ),
        Effect.flatMap(() => callInfoApi(label, fn)),
      );

    return UserDataService.of({
      getClearinghouseState: (walletAddress) =>
        infoCall("clearinghouseState", () => info.clearinghouseState({ user: walletAddress })),

      getSpotClearinghouseState: (walletAddress) =>
        infoCall("spotClearinghouseState", () =>
          info.spotClearinghouseState({ user: walletAddress }),
        ),

      getOpenOrders: (walletAddress) =>
        infoCall("openOrders", () => info.openOrders({ user: walletAddress })),

      getFrontendOpenOrders: (walletAddress) =>
        infoCall("frontendOpenOrders", () => info.frontendOpenOrders({ user: walletAddress })),

      getMeta: () => infoCall("meta", () => info.meta()),

      getHistoricalOrders: (walletAddress) =>
        infoCall("historicalOrders", () => info.historicalOrders({ user: walletAddress })),

      getUserFills: (walletAddress) =>
        infoCall("userFills", () => info.userFills({ user: walletAddress })),

      getPortfolio: (walletAddress) =>
        infoCall("portfolio", () => info.portfolio({ user: walletAddress })),

      getUserVaultEquities: (walletAddress) =>
        infoCall("userVaultEquities", () => info.userVaultEquities({ user: walletAddress })),

      getUserFunding: (walletAddress, startTime?: number, endTime?: number) =>
        infoCall("userFunding", () => {
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
