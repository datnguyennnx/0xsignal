export type { ChartDataPoint, AggregatedMarket, MarketTicker } from "@0xsignal/shared";
export type {
  ClearinghouseState,
  SpotClearinghouseState,
  OpenOrder,
  FrontendOpenOrder,
  HistoricalOrderEntry,
  UserFill,
} from "@0xsignal/shared";
export type {
  PlaceOrderRequest,
  UpdateLeverageRequest,
  CancelOrdersRequest,
} from "@0xsignal/shared";
export type {
  PortfolioPeriod,
  PortfolioPeriodKey,
  PortfolioResponse,
  UserVaultEquity,
  UserFundingDelta,
  UserFundingEntry,
} from "@0xsignal/shared";

export interface MarketPrice {
  readonly symbol: string;
  readonly price: number;
  readonly change24h: number;
  readonly volume24h: number;
  readonly openInterest: number;
  readonly funding: number;
  readonly markPx: number;
  readonly midPx: number;
  readonly prevDayPx: number;
  readonly high24h?: number;
  readonly low24h?: number;
  readonly timestamp: Date;
}
