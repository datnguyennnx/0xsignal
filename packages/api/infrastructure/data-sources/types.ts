/** Data Source Types - Provider abstractions */

import { Data } from "effect";

// Errors
export class DataSourceError extends Data.TaggedError("DataSourceError")<{
  readonly source: string;
  readonly message: string;
  readonly symbol?: string;
  readonly cause?: unknown;
}> {}

// Adapter metadata
export interface AdapterCapabilities {
  readonly spotPrices: boolean;
  readonly futuresPrices: boolean;

  readonly openInterest: boolean;
  readonly fundingRates: boolean;
  readonly heatmap: boolean;
  readonly historicalData: boolean;
  readonly realtime: boolean;
}

export interface AdapterInfo {
  readonly name: string;
  readonly version: string;
  readonly capabilities: AdapterCapabilities;
  readonly rateLimit: { readonly requestsPerMinute: number; readonly requestsPerSecond?: number };
}
