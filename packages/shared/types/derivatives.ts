/** Derivatives Data Types (OI, Funding) */

export interface OpenInterestData {
  readonly symbol: string;
  readonly openInterestUsd: number;
  readonly changePercent24h: number; // e.g. 5.5 for +5.5%
  readonly timestamp: Date;
}

export interface FundingRateData {
  readonly symbol: string;
  readonly fundingRate: number; // e.g. 0.0001 for 0.01%
  readonly timestamp: Date;
}
