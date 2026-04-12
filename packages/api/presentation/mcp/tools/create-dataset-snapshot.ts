import { Effect } from "effect";
import { getMcpDependencies } from "../server";

export const createDatasetSnapshotTool = {
  name: "create_dataset_snapshot",
  description: "Create a frozen snapshot of a dataset for reproducible backtesting",
  inputSchema: {
    type: "object",
    properties: {
      request_id: { type: "string" },
      symbol: { type: "string" },
      exchange: { type: "string" },
      timeframe: { type: "string" },
      start_time: { type: "string" },
      end_time: { type: "string" },
      row_count: { type: "integer" },
      checksum: { type: "string" },
    },
  },
  execute: (input: {
    request_id?: string;
    symbol?: string;
    exchange?: string;
    timeframe?: string;
    start_time?: string;
    end_time?: string;
    row_count?: number;
    checksum?: string;
  }) => {
    const deps = getMcpDependencies();
    return deps.marketDataServices
      .createDatasetSnapshot({
        id: crypto.randomUUID(),
        request_id: input.request_id ?? "",
        symbol: input.symbol ?? "",
        exchange: input.exchange ?? "binance",
        timeframe: input.timeframe ?? "1h",
        start_time: input.start_time ?? new Date().toISOString(),
        end_time: input.end_time ?? new Date().toISOString(),
        row_count: input.row_count ?? 0,
        checksum: input.checksum,
      })
      .pipe(
        Effect.map((snapshot) => ({
          snapshot_id: snapshot.id,
          symbol: snapshot.symbol,
          timeframe: snapshot.timeframe,
        }))
      );
  },
};
