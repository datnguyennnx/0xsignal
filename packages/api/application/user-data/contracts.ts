import { Context, type Effect } from "effect";
import type { DomainError } from "../errors";

export class UserDataServices extends Context.Tag("UserDataServices")<
  UserDataServices,
  {
    readonly getClearinghouseState: () => Effect.Effect<unknown, DomainError>;
    readonly getOpenOrders: () => Effect.Effect<unknown, DomainError>;
    readonly getHistoricalOrders: () => Effect.Effect<unknown, DomainError>;
    readonly getUserFills: () => Effect.Effect<unknown, DomainError>;
  }
>() {}
