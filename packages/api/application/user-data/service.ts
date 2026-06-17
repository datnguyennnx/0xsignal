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
        callInfoApi("clearinghouseState", () => info.clearinghouseState({ user: walletAddress })),

      getSpotClearinghouseState: (walletAddress) =>
        callInfoApi("spotClearinghouseState", () =>
          info.spotClearinghouseState({ user: walletAddress }),
        ),

      getOpenOrders: (walletAddress) =>
        callInfoApi("openOrders", () => info.openOrders({ user: walletAddress })),

      getFrontendOpenOrders: (walletAddress) =>
        callInfoApi("frontendOpenOrders", () => info.frontendOpenOrders({ user: walletAddress })),

      getMeta: () => callInfoApi("meta", () => info.meta()),

      getHistoricalOrders: (walletAddress) =>
        callInfoApi("historicalOrders", () => info.historicalOrders({ user: walletAddress })),

      getUserFills: (walletAddress) =>
        callInfoApi("userFills", () => info.userFills({ user: walletAddress })),

      getPortfolio: (walletAddress) =>
        callInfoApi("portfolio", () => info.portfolio({ user: walletAddress })),

      getUserVaultEquities: (walletAddress) =>
        callInfoApi("userVaultEquities", () => info.userVaultEquities({ user: walletAddress })),

      getUserFunding: (walletAddress, startTime?: number, endTime?: number) =>
        callInfoApi("userFunding", () => {
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
