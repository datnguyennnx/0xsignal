import { Context, type Effect } from "effect";
import type { DomainError } from "../errors";

export class UserDataService extends Context.Service<
  UserDataService,
  {
    readonly getClearinghouseState: () => Effect.Effect<unknown, DomainError>;
    readonly getSpotClearinghouseState: () => Effect.Effect<unknown, DomainError>;
    readonly getOpenOrders: () => Effect.Effect<unknown, DomainError>;
    readonly getFrontendOpenOrders: () => Effect.Effect<unknown, DomainError>;
    readonly getMeta: () => Effect.Effect<unknown, DomainError>;
    readonly getHistoricalOrders: () => Effect.Effect<unknown, DomainError>;
    readonly getUserFills: () => Effect.Effect<unknown, DomainError>;
    readonly getPortfolio: () => Effect.Effect<unknown, DomainError>;
    readonly getUserVaultEquities: () => Effect.Effect<unknown, DomainError>;
    readonly getUserFunding: (
      startTime?: number,
      endTime?: number
    ) => Effect.Effect<unknown, DomainError>;
  }
>()("UserDataService") {}
