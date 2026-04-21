import type { CandlestickRequest, DatasetSnapshot } from "@schemas/market-data";

export interface MarketDataRepository {
  insertCandlestickRequest(request: CandlestickRequest): Promise<CandlestickRequest>;
  getCandlestickRequest(id: string): Promise<CandlestickRequest | null>;
  insertDatasetSnapshot(snapshot: DatasetSnapshot): Promise<DatasetSnapshot>;
  getDatasetSnapshot(id: string): Promise<DatasetSnapshot | null>;
}
