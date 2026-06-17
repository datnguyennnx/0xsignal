import { Context, type Effect } from "effect";
import type { AppError } from "../errors";
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
    ) => Effect.Effect<ClearinghouseState, AppError>;
    readonly getSpotClearinghouseState: (
      walletAddress: string,
    ) => Effect.Effect<SpotClearinghouseState, AppError>;
    readonly getOpenOrders: (walletAddress: string) => Effect.Effect<OpenOrder[], AppError>;
    readonly getFrontendOpenOrders: (
      walletAddress: string,
    ) => Effect.Effect<FrontendOpenOrder[], AppError>;
    readonly getMeta: () => Effect.Effect<AggregatedMarket[], AppError>;
    readonly getHistoricalOrders: (
      walletAddress: string,
    ) => Effect.Effect<HistoricalOrderEntry[], AppError>;
    readonly getUserFills: (walletAddress: string) => Effect.Effect<UserFill[], AppError>;
    readonly getPortfolio: (walletAddress: string) => Effect.Effect<PortfolioResponse, AppError>;
    readonly getUserVaultEquities: (
      walletAddress: string,
    ) => Effect.Effect<UserVaultEquity[], AppError>;
    readonly getUserFunding: (
      walletAddress: string,
      startTime?: number,
      endTime?: number,
    ) => Effect.Effect<UserFundingEntry[], AppError>;
  }
>()("UserDataService") {}
