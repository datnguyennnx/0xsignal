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
import { DomainError } from "../errors";
import { UserDataService } from "./contracts";

const callInfoApi = <A>(label: string, fn: () => Promise<A>): Effect.Effect<A, DomainError> =>
  Effect.tryPromise({
    try: fn,
    catch: (cause) =>
      new DomainError({
        code: "INTERNAL_ERROR",
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
        ) as Effect.Effect<ClearinghouseState, DomainError>,

      getSpotClearinghouseState: (walletAddress) =>
        callInfoApi("spotClearinghouseState", () =>
          info.spotClearinghouseState({ user: walletAddress }),
        ) as Effect.Effect<SpotClearinghouseState, DomainError>,

      getOpenOrders: (walletAddress) =>
        callInfoApi("openOrders", () => info.openOrders({ user: walletAddress })) as Effect.Effect<
          OpenOrder[],
          DomainError
        >,

      getFrontendOpenOrders: (walletAddress) =>
        callInfoApi("frontendOpenOrders", () =>
          info.frontendOpenOrders({ user: walletAddress }),
        ) as Effect.Effect<FrontendOpenOrder[], DomainError>,

      getMeta: () =>
        callInfoApi("meta", () => info.meta()) as unknown as Effect.Effect<
          AggregatedMarket[],
          DomainError
        >,

      getHistoricalOrders: (walletAddress) =>
        callInfoApi("historicalOrders", () =>
          info.historicalOrders({ user: walletAddress }),
        ) as Effect.Effect<HistoricalOrderEntry[], DomainError>,

      getUserFills: (walletAddress) =>
        callInfoApi("userFills", () => info.userFills({ user: walletAddress })) as Effect.Effect<
          UserFill[],
          DomainError
        >,

      getPortfolio: (walletAddress) =>
        callInfoApi("portfolio", () => info.portfolio({ user: walletAddress })) as Effect.Effect<
          PortfolioResponse,
          DomainError
        >,

      getUserVaultEquities: (walletAddress) =>
        callInfoApi("userVaultEquities", () =>
          info.userVaultEquities({ user: walletAddress }),
        ) as Effect.Effect<UserVaultEquity[], DomainError>,

      getUserFunding: (walletAddress, startTime?: number, endTime?: number) =>
        callInfoApi("userFunding", () => {
          const params: { user: string; startTime?: number; endTime?: number } = {
            user: walletAddress,
          };
          if (startTime !== undefined) params.startTime = startTime;
          if (endTime !== undefined) params.endTime = endTime;
          return info.userFunding(params);
        }) as Effect.Effect<UserFundingEntry[], DomainError>,
    });
  }),
);
