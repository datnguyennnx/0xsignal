import { Effect, Layer } from "effect";
import { HyperliquidClient } from "../../infrastructure/data-sources/hyperliquid/client";
import { DomainError } from "../errors";
import { UserDataService } from "./contracts";

export const userDataServiceLayer = Layer.effect(
  UserDataService,
  Effect.gen(function* () {
    const { info } = yield* HyperliquidClient;

    return UserDataService.of({
      getClearinghouseState: (walletAddress) =>
        Effect.tryPromise({
          try: () => info.clearinghouseState({ user: walletAddress }),
          catch: (cause) =>
            new DomainError({
              code: "INTERNAL_ERROR",
              message: "Failed to fetch clearinghouse state",
              cause,
            }),
        }),

      getSpotClearinghouseState: (walletAddress) =>
        Effect.tryPromise({
          try: () => info.spotClearinghouseState({ user: walletAddress }),
          catch: (cause) =>
            new DomainError({
              code: "INTERNAL_ERROR",
              message: "Failed to fetch spot clearinghouse state",
              cause,
            }),
        }),

      getOpenOrders: (walletAddress) =>
        Effect.tryPromise({
          try: () => info.openOrders({ user: walletAddress }),
          catch: (cause) =>
            new DomainError({
              code: "INTERNAL_ERROR",
              message: "Failed to fetch open orders",
              cause,
            }),
        }),

      getFrontendOpenOrders: (walletAddress) =>
        Effect.tryPromise({
          try: () => info.frontendOpenOrders({ user: walletAddress }),
          catch: (cause) =>
            new DomainError({
              code: "INTERNAL_ERROR",
              message: "Failed to fetch frontend open orders",
              cause,
            }),
        }),

      getMeta: () =>
        Effect.tryPromise({
          try: () => info.meta(),
          catch: (cause) =>
            new DomainError({ code: "INTERNAL_ERROR", message: "Failed to fetch meta", cause }),
        }),

      getHistoricalOrders: (walletAddress) =>
        Effect.tryPromise({
          try: () => info.historicalOrders({ user: walletAddress }),
          catch: (cause) =>
            new DomainError({
              code: "INTERNAL_ERROR",
              message: "Failed to fetch historical orders",
              cause,
            }),
        }),

      getUserFills: (walletAddress) =>
        Effect.tryPromise({
          try: () => info.userFills({ user: walletAddress }),
          catch: (cause) =>
            new DomainError({
              code: "INTERNAL_ERROR",
              message: "Failed to fetch user fills",
              cause,
            }),
        }),

      getPortfolio: (walletAddress) =>
        Effect.tryPromise({
          try: () => info.portfolio({ user: walletAddress }),
          catch: (cause) =>
            new DomainError({
              code: "INTERNAL_ERROR",
              message: "Failed to fetch portfolio",
              cause,
            }),
        }),

      getUserVaultEquities: (walletAddress) =>
        Effect.tryPromise({
          try: () => info.userVaultEquities({ user: walletAddress }),
          catch: (cause) =>
            new DomainError({
              code: "INTERNAL_ERROR",
              message: "Failed to fetch user vault equities",
              cause,
            }),
        }),

      getUserFunding: (walletAddress, startTime?: number, endTime?: number) =>
        Effect.tryPromise({
          try: () => {
            const params: { user: string; startTime?: number; endTime?: number } = {
              user: walletAddress,
            };
            if (startTime !== undefined) params.startTime = startTime;
            if (endTime !== undefined) params.endTime = endTime;
            return info.userFunding(params);
          },
          catch: (cause) =>
            new DomainError({
              code: "INTERNAL_ERROR",
              message: "Failed to fetch user funding",
              cause,
            }),
        }),
    });
  })
);
