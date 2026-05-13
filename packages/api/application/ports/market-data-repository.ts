import { Context, Effect } from "effect";
import type { CandlestickRequest, DatasetSnapshot } from "../../schemas/market-data";
import { DomainError } from "../errors";

export interface MarketDataRepository {
  readonly insertCandlestickRequest: (
    request: CandlestickRequest
  ) => Effect.Effect<CandlestickRequest, DomainError>;
  readonly insertDatasetSnapshot: (
    snapshot: DatasetSnapshot
  ) => Effect.Effect<DatasetSnapshot, DomainError>;
  readonly getDatasetSnapshot: (id: string) => Effect.Effect<DatasetSnapshot | null, DomainError>;
}

export const MarketDataRepository = Context.GenericTag<MarketDataRepository>(
  "@services/MarketDataRepository"
);
