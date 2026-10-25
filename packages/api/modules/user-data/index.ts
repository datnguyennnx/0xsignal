import { Context, type Effect } from "effect";
import type {
  ClearinghouseState,
  FrontendOpenOrder,
  UserFill,
  PortfolioResponse,
  UserVaultEquity,
} from "@0xsignal/shared";
import type {
  HistoricalOrdersResponse,
  SpotClearinghouseStateResponse,
  UserFundingResponse,
} from "@nktkas/hyperliquid/api/info";
import type { AppError } from "../../shared/errors";

export class UserDataService extends Context.Service<
  UserDataService,
  {
    readonly getClearinghouseState: (
      walletAddress: string,
    ) => Effect.Effect<ClearinghouseState, AppError>;
    readonly getSpotClearinghouseState: (
      walletAddress: string,
    ) => Effect.Effect<SpotClearinghouseStateResponse, AppError>;
    readonly getFrontendOpenOrders: (
      walletAddress: string,
    ) => Effect.Effect<FrontendOpenOrder[], AppError>;
    readonly getHistoricalOrders: (
      walletAddress: string,
    ) => Effect.Effect<HistoricalOrdersResponse, AppError>;
    readonly getUserFills: (walletAddress: string) => Effect.Effect<UserFill[], AppError>;
    readonly getPortfolio: (walletAddress: string) => Effect.Effect<PortfolioResponse, AppError>;
    readonly getUserVaultEquities: (
      walletAddress: string,
    ) => Effect.Effect<UserVaultEquity[], AppError>;
    readonly getUserFunding: (
      walletAddress: string,
      startTime?: number,
      endTime?: number,
    ) => Effect.Effect<UserFundingResponse, AppError>;
  }
>()("UserDataService") {}
