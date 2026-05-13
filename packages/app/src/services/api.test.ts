import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChartDataPoint } from "@0xsignal/shared";
import { api, normalizeChartDataPoints } from "./api";

describe("normalizeChartDataPoints", () => {
  it("sorts ascending and dedupes duplicate timestamps with last value winning", () => {
    const points: ChartDataPoint[] = [
      { time: 3, open: 30, high: 31, low: 29, close: 30, volume: 300 },
      { time: 1, open: 10, high: 11, low: 9, close: 10, volume: 100 },
      { time: 2, open: 20, high: 21, low: 19, close: 20, volume: 200 },
      { time: 2, open: 200, high: 210, low: 190, close: 205, volume: 2000 },
      { time: 1, open: 100, high: 110, low: 90, close: 105, volume: 1000 },
    ];

    expect(normalizeChartDataPoints(points)).toEqual([
      { time: 1, open: 100, high: 110, low: 90, close: 105, volume: 1000 },
      { time: 2, open: 200, high: 210, low: 190, close: 205, volume: 2000 },
      { time: 3, open: 30, high: 31, low: 29, close: 30, volume: 300 },
    ]);
  });
});

describe("api candle payload contracts", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("getRecentChartLane maps lane payload into normalized chart points", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          candles: [
            { t: 1716000120000, o: "12", h: "15", l: "10", c: "14", v: "100" },
            { t: 1716000000000, o: "10", h: "13", l: "9", c: "12", v: "90" },
            { t: 1716000120000, o: "12", h: "16", l: "10", c: "15", v: "120" },
          ],
          provenance: "hyperliquid",
          coverage: {
            hasData: true,
            rowCount: 3,
            expectedCount: 3,
            fullCoverage: true,
            missingWindows: [],
          },
        },
      }),
    } as Response);

    const result = await api.getRecentChartLane({
      symbol: "ETHUSDC",
      interval: "1m",
      limit: 200,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/api/candles/recent?");
    expect(result).toEqual([
      { time: 1716000000, open: 10, high: 13, low: 9, close: 12, volume: 90 },
      { time: 1716000120, open: 12, high: 16, low: 10, close: 15, volume: 120 },
    ]);
  });

  it("getCandles accepts candles payload shape", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          candles: [{ t: 1716000000000, o: "1", h: "2", l: "1", c: "2", v: "5" }],
          provenance: "hyperliquid",
          coverage: {
            hasData: true,
            rowCount: 1,
            expectedCount: 1,
            fullCoverage: true,
            missingWindows: [],
          },
        },
      }),
    } as Response);

    await expect(
      api.getCandles({
        symbol: "ETH",
        interval: "1m",
      })
    ).resolves.toEqual([{ time: 1716000000, open: 1, high: 2, low: 1, close: 2, volume: 5 }]);
  });
});
