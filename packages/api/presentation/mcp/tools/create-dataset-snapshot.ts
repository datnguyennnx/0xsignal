import { Effect } from "effect";
import { MarketDataServices } from "../../../application/market-data";
import { validationError } from "../../../application/errors";

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
    required: ["request_id", "symbol", "exchange", "timeframe", "start_time", "end_time"],
  },
  execute: (input: {
    request_id: string;
    symbol: string;
    exchange: string;
    timeframe: "1m" | "5m" | "15m" | "1h" | "4h" | "1d";
    start_time: string;
    end_time: string;
    checksum?: string;
    _interactionId?: string;
  }) =>
    Effect.gen(function* () {
      const services = yield* MarketDataServices;
      const coverage = yield* services.inspectCoverage({
        symbol: input.symbol,
        exchange: input.exchange,
        timeframe: input.timeframe,
        startTime: new Date(input.start_time),
        endTime: new Date(input.end_time),
      });

      if (!coverage.fullCoverage) {
        return yield* Effect.fail(
          validationError(
            `Cannot create snapshot: Incomplete coverage in QuestDB (${coverage.rowCount}/${coverage.expectedCount} rows). Use ensure_candle_coverage first.`
          )
        );
      }

      // 2. Freeze snapshot if coverage is okay
      const snapshot = yield* services.createDatasetSnapshot({
        id: crypto.randomUUID(),
        request_id: input.request_id,
        symbol: input.symbol,
        exchange: input.exchange,
        timeframe: input.timeframe,
        start_time: input.start_time,
        end_time: input.end_time,
        row_count: coverage.rowCount,
        checksum: input.checksum,
        trace_id: input._interactionId,
      });

      return {
        snapshot_id: snapshot.id,
        symbol: snapshot.symbol,
        timeframe: snapshot.timeframe,
        row_count: snapshot.row_count,
        provenance: "QuestDB (Verified)",
      };
    }),
};
