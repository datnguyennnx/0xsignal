import { Context } from "effect";
import type { CandlestickRequest, DatasetSnapshot } from "../../schemas/market-data";

export interface MarketDataRepository {
  readonly insertCandlestickRequest: (request: CandlestickRequest) => Promise<CandlestickRequest>;
  readonly insertDatasetSnapshot: (snapshot: DatasetSnapshot) => Promise<DatasetSnapshot>;
  readonly getDatasetSnapshot: (id: string) => Promise<DatasetSnapshot | null>;
}

export const MarketDataRepository = Context.GenericTag<MarketDataRepository>(
  "@services/MarketDataRepository"
);
