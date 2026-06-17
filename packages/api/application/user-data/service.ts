import type {
  ClearinghouseState,
  SpotClearinghouseState,
  OpenOrder,
  FrontendOpenOrder,
  HistoricalOrderEntry,
  UserFill,
  PortfolioResponse,
  UserVaultEquity,
  UserFundingEntry,
  AggregatedMarket,
} from "@0xsignal/shared";
import { Effect, Layer } from "effect";
import { HyperliquidClient } from "../hyperliquid/contracts";
import { InternalError } from "../errors";
import type { AppError } from "../errors";
import { UserDataService } from "./contracts";

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

    return UserDataService.of({
      getClearinghouseState: (walletAddress) =>
        callInfoApi("clearinghouseState", () =>
          info.clearinghouseState({ user: walletAddress }),
        ) as Effect.Effect<ClearinghouseState, AppError>,

      getSpotClearinghouseState: (walletAddress) =>
        callInfoApi("spotClearinghouseState", () =>
          info.spotClearinghouseState({ user: walletAddress }),
        ) as Effect.Effect<SpotClearinghouseState, AppError>,

      getOpenOrders: (walletAddress) =>
        callInfoApi("openOrders", () => info.openOrders({ user: walletAddress })) as Effect.Effect<
          OpenOrder[],
          AppError
        >,

      getFrontendOpenOrders: (walletAddress) =>
        callInfoApi("frontendOpenOrders", () =>
          info.frontendOpenOrders({ user: walletAddress }),
        ) as Effect.Effect<FrontendOpenOrder[], AppError>,

      getMeta: () =>
        callInfoApi("meta", () => info.meta()) as unknown as Effect.Effect<
          AggregatedMarket[],
          AppError
        >,

      getHistoricalOrders: (walletAddress) =>
        callInfoApi("historicalOrders", () =>
          info.historicalOrders({ user: walletAddress }),
        ) as Effect.Effect<HistoricalOrderEntry[], AppError>,

      getUserFills: (walletAddress) =>
        callInfoApi("userFills", () => info.userFills({ user: walletAddress })) as Effect.Effect<
          UserFill[],
          AppError
        >,

      getPortfolio: (walletAddress) =>
        callInfoApi("portfolio", () => info.portfolio({ user: walletAddress })) as Effect.Effect<
          PortfolioResponse,
          AppError
        >,

      getUserVaultEquities: (walletAddress) =>
        callInfoApi("userVaultEquities", () =>
          info.userVaultEquities({ user: walletAddress }),
        ) as Effect.Effect<UserVaultEquity[], AppError>,

      getUserFunding: (walletAddress, startTime?: number, endTime?: number) =>
        callInfoApi("userFunding", () => {
          const params: { user: string; startTime?: number; endTime?: number } = {
            user: walletAddress,
          };
          if (startTime !== undefined) params.startTime = startTime;
          if (endTime !== undefined) params.endTime = endTime;
          return info.userFunding(params);
        }) as Effect.Effect<UserFundingEntry[], AppError>,
    });
  }),
);
