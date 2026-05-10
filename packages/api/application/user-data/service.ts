import { Effect, Layer } from "effect";
import { HyperliquidClient } from "../../infrastructure/data-sources/hyperliquid/client";
import { domainError } from "../errors";
import { UserDataServices } from "./contracts";

const getWalletAddress = (): string => {
  const address = process.env.HYPERLIQUID_WALLET_ADDRESS;
  if (!address) {
    throw new Error("HYPERLIQUID_WALLET_ADDRESS environment variable is not set");
  }
  return address;
};

export const UserDataServicesLive = Layer.effect(
  UserDataServices,
  Effect.gen(function* () {
    const { info } = yield* HyperliquidClient;
    const walletAddress = yield* Effect.sync(() => getWalletAddress());

    return UserDataServices.of({
      getClearinghouseState: () =>
        Effect.tryPromise({
          try: () => info.clearinghouseState({ user: walletAddress }),
          catch: (cause) =>
            domainError("INTERNAL_ERROR", "Failed to fetch clearinghouse state", cause),
        }),

      getOpenOrders: () =>
        Effect.tryPromise({
          try: () => info.openOrders({ user: walletAddress }),
          catch: (cause) => domainError("INTERNAL_ERROR", "Failed to fetch open orders", cause),
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
