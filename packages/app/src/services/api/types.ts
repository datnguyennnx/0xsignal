export type {
  ClearinghouseState,
  SpotClearinghouseState,
  FrontendOpenOrder,
  HistoricalOrderEntry,
  UserFill,
} from "@0xsignal/shared";
export type { PlaceOrderRequest, UpdateLeverageRequest } from "@0xsignal/shared";
export type { PortfolioResponse, UserVaultEquity, UserFundingEntry } from "@0xsignal/shared";

/**
 * The price-bearing slice of a ticker. `null` is "the ticker carried no quote",
 * which `0` cannot express: inside a non-null quote, `0` is a real zero price.
 */
export type MarketQuote = {
  readonly price: number;
  readonly change24h: number | null;
  readonly volume24h: number | null;
  readonly openInterest: number | null;
  readonly funding: number | null;
  readonly markPx: number | null;
  readonly midPx: number | null;
  readonly prevDayPx: number | null;
} | null;

export interface MarketPrice {
  readonly symbol: string;
  /**
   * Presence channel for the quote. `null`/absent means no price was received;
   * read this, not the numeric mirror below, to tell absence from a real `0`.
   */
  readonly quote?: MarketQuote;
  /** Numeric mirror of `quote`; `0` when `quote` is `null`/absent. */
  readonly price: number;
  readonly change24h: number | null;
  readonly volume24h: number | null;
  readonly openInterest: number | null;
  readonly funding: number | null;
  readonly markPx: number | null;
  readonly midPx: number | null;
  readonly prevDayPx: number | null;
  readonly high24h?: number;
  readonly low24h?: number;
  readonly timestamp: Date;
}
