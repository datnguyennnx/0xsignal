import { describe, expect, it, vi, beforeEach } from "vitest";
import { Effect, Layer } from "effect";
import { QuestDBClient, query, ingest, type QuestDBResponse } from "../client";
import { checkCoverage } from "../repositories/candle";
import { insertCandles } from "../repositories/candle";

vi.mock("../client", () => ({
  query: vi.fn(),
  ingest: vi.fn(),
  command: vi.fn(),
  QuestDBClient: {
    Tag: vi.fn(() => ({})),
    of: vi.fn((x) => x),
  },
}));

const TestQuestDB = Layer.succeed(QuestDBClient, QuestDBClient.of({ httpUrl: "http://test" }));

describe("QuestDB Candle Coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks coverage partial when duplicates hide missing timestamps", async () => {
    vi.mocked(query).mockReturnValue(
      Effect.succeed({
        query: "SELECT",
        columns: [],
        dataset: [
          ["2024-01-01T00:00:00.000Z"],
          ["2024-01-01T00:00:00.000Z"],
          ["2024-01-01T00:02:00.000Z"],
        ],
        count: 3,
      } satisfies QuestDBResponse)
    );

    const result = await Effect.runPromise(
      checkCoverage(
        "BTC",
        "Hyperliquid",
        "1m",
        new Date("2024-01-01T00:00:00.000Z"),
        new Date("2024-01-01T00:02:00.000Z")
      ).pipe(Effect.provide(TestQuestDB))
    );

    expect(result.rowCount).toBe(3);
    expect(result.expectedCount).toBe(3);
    expect(result.missingWindows).toHaveLength(1);
    expect(result.missingWindows[0].start.toISOString()).toBe("2024-01-01T00:01:00.000Z");
    expect(result.missingWindows[0].end.toISOString()).toBe("2024-01-01T00:01:00.000Z");
    expect(result.fullCoverage).toBe(false);
  });

  it("allows full coverage when duplicates exist but no gaps", async () => {
    vi.mocked(query).mockReturnValue(
      Effect.succeed({
        query: "SELECT",
        columns: [],
        dataset: [
          ["2024-01-01T00:00:00.000Z"],
          ["2024-01-01T00:00:00.000Z"],
          ["2024-01-01T00:01:00.000Z"],
          ["2024-01-01T00:02:00.000Z"],
        ],
        count: 4,
      } satisfies QuestDBResponse)
    );

    const result = await Effect.runPromise(
      checkCoverage(
        "BTC",
        "Hyperliquid",
        "1m",
        new Date("2024-01-01T00:00:00.000Z"),
        new Date("2024-01-01T00:02:00.000Z")
      ).pipe(Effect.provide(TestQuestDB))
    );

    expect(result.missingWindows).toHaveLength(0);
    expect(result.fullCoverage).toBe(true);
  });

  it("inserts candles through ILP with nanosecond timestamps", async () => {
    vi.mocked(ingest).mockReturnValue(Effect.succeed(undefined));

    await Effect.runPromise(
      insertCandles("BTC", "Hyperliquid", "1m", [
        {
          timestamp: new Date("2024-04-12T12:30:00.000Z"),
          open: 60000,
          high: 61000,
          low: 59000,
          close: 60500,
          volume: 10,
        },
      ]).pipe(Effect.provide(TestQuestDB))
    );

    expect(ingest).toHaveBeenCalledTimes(1);
    const line = vi.mocked(ingest).mock.calls[0]?.[0]?.[0];
    expect(typeof line).toBe("string");
    expect(line).toContain("candle,symbol=BTC,exchange=Hyperliquid,timeframe=1m ");
    expect(line).toContain("open=60000,high=61000,low=59000,close=60500,volume=10");
    expect(line).toContain("1712925000000000000");
  });
});
