import { Context, type Effect } from "effect";
import type { DomainError } from "../errors";
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
} from "@0xsignal/shared";
import type { AggregatedMarket } from "@0xsignal/shared";

export class UserDataService extends Context.Service<
  UserDataService,
  {
    readonly getClearinghouseState: (
      walletAddress: string,
    ) => Effect.Effect<ClearinghouseState, DomainError>;
    readonly getSpotClearinghouseState: (
      walletAddress: string,
    ) => Effect.Effect<SpotClearinghouseState, DomainError>;
    readonly getOpenOrders: (walletAddress: string) => Effect.Effect<OpenOrder[], DomainError>;
    readonly getFrontendOpenOrders: (
      walletAddress: string,
    ) => Effect.Effect<FrontendOpenOrder[], DomainError>;
    readonly getMeta: () => Effect.Effect<AggregatedMarket[], DomainError>;
    readonly getHistoricalOrders: (
      walletAddress: string,
    ) => Effect.Effect<HistoricalOrderEntry[], DomainError>;
    readonly getUserFills: (walletAddress: string) => Effect.Effect<UserFill[], DomainError>;
    readonly getPortfolio: (walletAddress: string) => Effect.Effect<PortfolioResponse, DomainError>;
    readonly getUserVaultEquities: (
      walletAddress: string,
    ) => Effect.Effect<UserVaultEquity[], DomainError>;
    readonly getUserFunding: (
      walletAddress: string,
      startTime?: number,
      endTime?: number,
    ) => Effect.Effect<UserFundingEntry[], DomainError>;
  }
>()("UserDataService") {}
