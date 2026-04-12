import { describe, it, expect, vi, beforeEach } from "vitest";
import { Effect, Layer } from "effect";
import * as repo from "../questdb/repositories/candle";
import { QuestDBClient, query, ingest } from "../questdb/client";

vi.mock("../questdb/client", () => ({
  query: vi.fn(),
  ingest: vi.fn(),
  command: vi.fn(),
  QuestDBClient: {
    Tag: vi.fn(() => ({})),
    of: vi.fn((x) => x),
  },
}));

const TestQuestDB = Layer.succeed(QuestDBClient, { httpUrl: "http://test" } as any);

describe("QuestDB Candle Repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getCandles should generate correct SQL and parse rows", async () => {
    vi.mocked(query).mockReturnValue(
      Effect.succeed({
        query: "SELECT",
        columns: [],
        dataset: [["2024-04-12T12:00:00.000000Z", 60000.5, 61000, 59000, 60500, 10]],
        count: 1,
      } as any)
    );

    const program = repo
      .getCandles({
        symbol: "BTC",
        exchange: "Hyperliquid",
        timeframe: "1m",
        limit: 10,
      })
      .pipe(Effect.provide(TestQuestDB));

    const result = await Effect.runPromise(program);

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("SELECT timestamp, open, high, low, close, volume")
    );
    expect(query).toHaveBeenCalledWith(expect.stringContaining("symbol = 'BTC'"));
    expect(result).toHaveLength(1);
    expect(result[0].open).toBe(60000.5);
  });

  it("insertCandles should use ILP ingest for performance and safety", async () => {
    vi.mocked(ingest).mockReturnValue(Effect.succeed(undefined));

    const program = repo
      .insertCandles("BTC", "Hyperliquid", "1m" as any, [
        {
          timestamp: new Date(1712932200000),
          open: 60000,
          high: 61000,
          low: 59000,
          close: 60500,
          volume: 10,
        },
      ])
      .pipe(Effect.provide(TestQuestDB));

    await Effect.runPromise(program);

    expect(ingest).toHaveBeenCalled();
    const lines = vi.mocked(ingest).mock.calls[0][0];
    expect(lines[0]).toContain("candle,symbol=BTC,exchange=Hyperliquid,timeframe=1m ");
    expect(lines[0]).toContain("open=60000,high=61000,low=59000,close=60500,volume=10");
    expect(lines[0]).toContain("1712932200000000000"); // Nanoseconds
  });

  it("checkCoverage should return correct rowCount", async () => {
    vi.mocked(query).mockReturnValue(
      Effect.succeed({
        query: "SELECT",
        columns: [],
        dataset: [[42]],
        count: 1,
      } as any)
    );

    const program = repo
      .checkCoverage("BTC", "HL", "1h", new Date(), new Date())
      .pipe(Effect.provide(TestQuestDB));

    const result = await Effect.runPromise(program);

    expect(result.rowCount).toBe(42);
    expect(result.hasData).toBe(true);
  });
});
