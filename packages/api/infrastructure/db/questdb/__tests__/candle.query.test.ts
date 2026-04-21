import { describe, expect, it } from "vitest";
import { buildCandleSelectQuery, buildCoverageTimestampQuery } from "../queries/candle";

describe("buildCandleSelectQuery", () => {
  it("does not force limit when omitted", () => {
    const sql = buildCandleSelectQuery({
      symbol: "BTC",
      exchange: "Hyperliquid",
      timeframe: "1m",
    });

    expect(sql).not.toContain("LIMIT");
  });

  it("includes limit when explicitly provided", () => {
    const sql = buildCandleSelectQuery({
      symbol: "BTC",
      exchange: "Hyperliquid",
      timeframe: "1m",
      limit: 250,
    });

    expect(sql).toContain("ORDER BY timestamp DESC");
    expect(sql).toContain("LIMIT 250");
    expect(sql).toContain("ORDER BY timestamp ASC");
  });

  it("does not apply limit when range flow disables range limit", () => {
    const sql = buildCandleSelectQuery({
      symbol: "BTC",
      exchange: "Hyperliquid",
      timeframe: "1m",
      startTime: new Date("2024-01-01T00:00:00.000Z"),
      endTime: new Date("2024-01-01T12:00:00.000Z"),
      limit: 250,
      disableLimitForRange: true,
    });

    expect(sql).not.toContain("LIMIT 250");
    expect(sql).toContain("timestamp >= '2024-01-01T00:00:00.000Z'");
    expect(sql).toContain("timestamp <= '2024-01-01T12:00:00.000Z'");
    expect(sql).toContain("ORDER BY timestamp ASC");
  });

  it("escapes single quotes in SQL string literals", () => {
    const sql = buildCandleSelectQuery({
      symbol: "BTC'USD",
      exchange: "Hyper'liquid",
      timeframe: "1m",
    });

    expect(sql).toContain("symbol = 'BTC''USD'");
    expect(sql).toContain("exchange = 'Hyper''liquid'");
  });

  it("builds coverage query with escaped literals", () => {
    const sql = buildCoverageTimestampQuery(
      "BTC'USD",
      "Hyper'liquid",
      "1m",
      new Date("2024-01-01T00:00:00.000Z"),
      new Date("2024-01-01T00:10:00.000Z")
    );

    expect(sql).toContain("symbol = 'BTC''USD'");
    expect(sql).toContain("exchange = 'Hyper''liquid'");
    expect(sql).toContain("timestamp >= '2024-01-01T00:00:00.000Z'");
    expect(sql).toContain("timestamp <= '2024-01-01T00:10:00.000Z'");
  });
});
