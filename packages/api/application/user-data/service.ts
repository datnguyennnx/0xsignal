import { Config, Effect, Layer, Option } from "effect";
import { HyperliquidClient } from "../../infrastructure/data-sources/hyperliquid/client";
import { DomainError } from "../errors";
import { UserDataService } from "./contracts";

// Lazy: wallet address read deferred from layer construction
const walletAddress: Effect.Effect<string, DomainError> = Config.option(
  Config.string("HYPERLIQUID_WALLET_ADDRESS")
).pipe(
  Effect.mapError(
    () =>
      new DomainError({
        code: "VALIDATION_ERROR",
        message: "Failed to read HYPERLIQUID_WALLET_ADDRESS config",
      })
  ),
  Effect.flatMap((opt) =>
    Option.match(opt, {
      onNone: () =>
        Effect.fail(
          new DomainError({
            code: "VALIDATION_ERROR",
            message: "HYPERLIQUID_WALLET_ADDRESS not configured. Cannot fetch user data.",
          })
        ),
      onSome: Effect.succeed,
    })
  )
);

export const userDataServiceLayer = Layer.effect(
  UserDataService,
  Effect.gen(function* () {
    const { info } = yield* HyperliquidClient;

    return UserDataService.of({
      getClearinghouseState: () =>
        Effect.gen(function* () {
          const addr = yield* walletAddress;
          return yield* Effect.tryPromise({
            try: () => info.clearinghouseState({ user: addr }),
            catch: (cause) =>
              new DomainError({
                code: "INTERNAL_ERROR",
                message: "Failed to fetch clearinghouse state",
                cause,
              }),
          });
        }),

      getSpotClearinghouseState: () =>
        Effect.gen(function* () {
          const addr = yield* walletAddress;
          return yield* Effect.tryPromise({
            try: () => info.spotClearinghouseState({ user: addr }),
            catch: (cause) =>
              new DomainError({
                code: "INTERNAL_ERROR",
                message: "Failed to fetch spot clearinghouse state",
                cause,
              }),
          });
        }),

      getOpenOrders: () =>
        Effect.gen(function* () {
          const addr = yield* walletAddress;
          return yield* Effect.tryPromise({
            try: () => info.openOrders({ user: addr }),
            catch: (cause) =>
              new DomainError({
                code: "INTERNAL_ERROR",
                message: "Failed to fetch open orders",
                cause,
              }),
          });
        }),

      getFrontendOpenOrders: () =>
        Effect.gen(function* () {
          const addr = yield* walletAddress;
          return yield* Effect.tryPromise({
            try: () => info.frontendOpenOrders({ user: addr }),
            catch: (cause) =>
              new DomainError({
                code: "INTERNAL_ERROR",
                message: "Failed to fetch frontend open orders",
                cause,
              }),
          });
        }),

      getMeta: () =>
        Effect.tryPromise({
          try: () => info.meta(),
          catch: (cause) =>
            new DomainError({ code: "INTERNAL_ERROR", message: "Failed to fetch meta", cause }),
        }),

      getHistoricalOrders: () =>
        Effect.gen(function* () {
          const addr = yield* walletAddress;
          return yield* Effect.tryPromise({
            try: () => info.historicalOrders({ user: addr }),
            catch: (cause) =>
              new DomainError({
                code: "INTERNAL_ERROR",
                message: "Failed to fetch historical orders",
                cause,
              }),
          });
        }),

      getUserFills: () =>
        Effect.gen(function* () {
          const addr = yield* walletAddress;
          return yield* Effect.tryPromise({
            try: () => info.userFills({ user: addr }),
            catch: (cause) =>
              new DomainError({
                code: "INTERNAL_ERROR",
                message: "Failed to fetch user fills",
                cause,
              }),
          });
        }),

      getPortfolio: () =>
        Effect.gen(function* () {
          const addr = yield* walletAddress;
          return yield* Effect.tryPromise({
            try: () => info.portfolio({ user: addr }),
            catch: (cause) =>
              new DomainError({
                code: "INTERNAL_ERROR",
                message: "Failed to fetch portfolio",
                cause,
              }),
          });
        }),

      getUserVaultEquities: () =>
        Effect.gen(function* () {
          const addr = yield* walletAddress;
          return yield* Effect.tryPromise({
            try: () => info.userVaultEquities({ user: addr }),
            catch: (cause) =>
              new DomainError({
                code: "INTERNAL_ERROR",
                message: "Failed to fetch user vault equities",
                cause,
              }),
          });
        }),

      getUserFunding: (startTime?: number, endTime?: number) =>
        Effect.gen(function* () {
          const addr = yield* walletAddress;
          return yield* Effect.tryPromise({
            try: () => {
              const params: { user: string; startTime?: number; endTime?: number } = {
                user: addr,
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
          });
        }),
    });
  })
);
