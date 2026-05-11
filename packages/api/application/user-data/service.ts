import { Effect, Layer } from "effect";
import { HyperliquidClient } from "../../infrastructure/data-sources/hyperliquid/client";
import { domainError, type DomainError } from "../errors";
import { UserDataServices } from "./contracts";

const getWalletAddress = (): Effect.Effect<string, DomainError> => {
  const address = process.env.HYPERLIQUID_WALLET_ADDRESS;
  if (!address) {
    return Effect.fail(
      domainError("INTERNAL_ERROR", "HYPERLIQUID_WALLET_ADDRESS environment variable is not set")
    );
  }
  return Effect.succeed(address);
};

export const UserDataServicesLive = Layer.effect(
  UserDataServices,
  Effect.gen(function* () {
    const { info } = yield* HyperliquidClient;
    const walletAddress = yield* getWalletAddress();

    return UserDataServices.of({
      getClearinghouseState: () =>
        Effect.tryPromise({
          try: () => info.clearinghouseState({ user: walletAddress }),
          catch: (cause) =>
            domainError("INTERNAL_ERROR", "Failed to fetch clearinghouse state", cause),
        }),

      getSpotClearinghouseState: () =>
        Effect.tryPromise({
          try: () => info.spotClearinghouseState({ user: walletAddress }),
          catch: (cause) =>
            domainError("INTERNAL_ERROR", "Failed to fetch spot clearinghouse state", cause),
        }),

      getOpenOrders: () =>
        Effect.tryPromise({
          try: () => info.openOrders({ user: walletAddress }),
          catch: (cause) => domainError("INTERNAL_ERROR", "Failed to fetch open orders", cause),
        }),

      getFrontendOpenOrders: () =>
        Effect.tryPromise({
          try: () => info.frontendOpenOrders({ user: walletAddress }),
          catch: (cause) =>
            domainError("INTERNAL_ERROR", "Failed to fetch frontend open orders", cause),
        }),

      getMeta: () =>
        Effect.tryPromise({
          try: () => info.meta(),
          catch: (cause) => domainError("INTERNAL_ERROR", "Failed to fetch meta", cause),
        }),

      getHistoricalOrders: () =>
        Effect.tryPromise({
          try: () => info.historicalOrders({ user: walletAddress }),
          catch: (cause) =>
            domainError("INTERNAL_ERROR", "Failed to fetch historical orders", cause),
        }),

      getUserFills: () =>
        Effect.tryPromise({
          try: () => info.userFills({ user: walletAddress }),
          catch: (cause) => domainError("INTERNAL_ERROR", "Failed to fetch user fills", cause),
        }),
    });
  })
);
