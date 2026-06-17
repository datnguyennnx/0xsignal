import { Context, type Effect } from "effect";
import type { DomainError } from "../errors";

export class UserDataService extends Context.Service<
  UserDataService,
  {
    readonly getClearinghouseState: (walletAddress: string) => Effect.Effect<unknown, DomainError>;
    readonly getSpotClearinghouseState: (
      walletAddress: string,
    ) => Effect.Effect<unknown, DomainError>;
    readonly getOpenOrders: (walletAddress: string) => Effect.Effect<unknown, DomainError>;
    readonly getFrontendOpenOrders: (walletAddress: string) => Effect.Effect<unknown, DomainError>;
    readonly getMeta: () => Effect.Effect<unknown, DomainError>;
    readonly getHistoricalOrders: (walletAddress: string) => Effect.Effect<unknown, DomainError>;
    readonly getUserFills: (walletAddress: string) => Effect.Effect<unknown, DomainError>;
    readonly getPortfolio: (walletAddress: string) => Effect.Effect<unknown, DomainError>;
    readonly getUserVaultEquities: (walletAddress: string) => Effect.Effect<unknown, DomainError>;
    readonly getUserFunding: (
      walletAddress: string,
      startTime?: number,
      endTime?: number,
    ) => Effect.Effect<unknown, DomainError>;
  }
>()("UserDataService") {}
