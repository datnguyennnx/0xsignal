import { Context, type Effect } from "effect";
import type { ExchangeClient } from "@nktkas/hyperliquid";
import type { ExchangeError } from "./contracts";

export type ResolvedExchangeCredentials = {
  readonly exchange: ExchangeClient;
  readonly vaultAddress?: string;
};

/** Builds an exchange client from the caller's stored agent credential. */
export class ExchangeCredentials extends Context.Service<
  ExchangeCredentials,
  {
    readonly resolve: (userId: string) => Effect.Effect<ResolvedExchangeCredentials, ExchangeError>;
  }
>()("ExchangeCredentials") {}
