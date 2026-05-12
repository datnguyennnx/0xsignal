import { describe, expect, it, vi } from "vitest";
import { Effect } from "effect";
import type { Candle } from "../../../schemas/market-data";
import { createCoverageRefresh, createGapFillWorkflow } from "../coverage-workflows";
import { mapMarketInfraError } from "../error-mapping";
import type { MarketCandleStorePort, MarketRemoteProviderPort } from "../contracts";
import type { CandleQuery } from "../types";

const baseQuery: CandleQuery = {
  symbol: "BTC",
  exchange: "hyperliquid",
  timeframe: "1m",
};

const incompleteCoverage = {
  hasData: true,
  rowCount: 1,
  expectedCount: 10,
  fullCoverage: false,
  missingWindows: [{ start: new Date(0), end: new Date(60_000) }],
};

const completeCoverage = {
  hasData: true,
  rowCount: 10,
  expectedCount: 10,
  fullCoverage: true,
  missingWindows: [] as { start: Date; end: Date }[],
};

describe("coverage workflows", () => {
  it("createCoverageRefresh returns immediately when first check is complete", async () => {
    const checkCoverage = vi.fn().mockReturnValue(Effect.succeed(completeCoverage));
    const candleRepo: MarketCandleStorePort = {
      getCandles: vi.fn(),
      checkCoverage,
      insertCandles: vi.fn(),
    };
    const refresh = createCoverageRefresh(candleRepo);
    const out = await Effect.runPromise(refresh(baseQuery, new Date(0), new Date(60_000)));
    expect(out).toEqual(completeCoverage);
    expect(checkCoverage).toHaveBeenCalledTimes(1);
  });

  it("createGapFillWorkflow skips remote fetch for non-hyperliquid exchange", async () => {
    const getCandleSnapshot = vi.fn();
    const candleRepo: MarketCandleStorePort = {
      getCandles: vi.fn(),
      checkCoverage: vi.fn(),
      insertCandles: vi.fn(),
    };
    const remoteProvider: MarketRemoteProviderPort = {
      getCandleSnapshot,
    };
    const workflow = createGapFillWorkflow(candleRepo, remoteProvider, mapMarketInfraError);
    const query: CandleQuery = { ...baseQuery, exchange: "other" };
    const out = await Effect.runPromise(
      workflow(query, incompleteCoverage, new Date(0), new Date(60_000))
    );
    expect(out).toBe(incompleteCoverage);
    expect(getCandleSnapshot).not.toHaveBeenCalled();
  });

  it("createGapFillWorkflow fetches and inserts when hyperliquid gaps exist", async () => {
    const remoteCandle: Candle = {
      timestamp: new Date(30_000),
      open: 1,
      high: 2,
      low: 0.5,
      close: 1.5,
      volume: 10,
    };
    const getCandleSnapshot = vi.fn().mockReturnValue(Effect.succeed([remoteCandle]));
    const insertCandles = vi.fn().mockReturnValue(Effect.succeed(undefined));
    const checkCoverage = vi.fn().mockReturnValue(Effect.succeed(completeCoverage));

    const candleRepo: MarketCandleStorePort = {
      getCandles: vi.fn(),
      checkCoverage,
      insertCandles,
    };
    const remoteProvider: MarketRemoteProviderPort = {
      getCandleSnapshot,
    };
    const workflow = createGapFillWorkflow(candleRepo, remoteProvider, mapMarketInfraError);
    const out = await Effect.runPromise(
      workflow(baseQuery, incompleteCoverage, new Date(0), new Date(60_000))
    );
    expect(getCandleSnapshot).toHaveBeenCalled();
    expect(insertCandles).toHaveBeenCalledWith("BTC", "hyperliquid", "1m", [remoteCandle]);
    expect(out).toEqual(completeCoverage);
  });
});
