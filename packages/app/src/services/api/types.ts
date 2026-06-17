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

export interface PortfolioPeriod {
  readonly accountValueHistory: [number, string][];
  readonly pnlHistory: [number, string][];
  readonly vlm: string;
}

export type PortfolioPeriodKey =
  | "day"
  | "week"
  | "month"
  | "allTime"
  | "perpDay"
  | "perpWeek"
  | "perpMonth"
  | "perpAllTime";

export type PortfolioResponse = readonly [
  readonly [PortfolioPeriodKey, PortfolioPeriod],
  readonly [PortfolioPeriodKey, PortfolioPeriod],
  readonly [PortfolioPeriodKey, PortfolioPeriod],
  readonly [PortfolioPeriodKey, PortfolioPeriod],
  readonly [PortfolioPeriodKey, PortfolioPeriod],
  readonly [PortfolioPeriodKey, PortfolioPeriod],
  readonly [PortfolioPeriodKey, PortfolioPeriod],
  readonly [PortfolioPeriodKey, PortfolioPeriod],
];

export interface UserVaultEquity {
  readonly vaultAddress: string;
  readonly equity: string;
  readonly lockedUntilTimestamp: number;
}

export interface UserFundingDelta {
  readonly type: "funding";
  readonly coin: string;
  readonly usdc: string;
  readonly szi: string;
  readonly fundingRate: string;
  readonly nSamples: number;
}

export interface UserFundingEntry {
  readonly time: number;
  readonly hash: string;
  readonly delta: UserFundingDelta;
}

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
