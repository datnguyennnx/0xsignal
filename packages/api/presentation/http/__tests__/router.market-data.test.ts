import { beforeEach, describe, expect, it, vi } from "vitest";
import { Effect, Layer, Context } from "effect";
import { MarketDataServices } from "../../../application/market-data/contracts";
import { HealthServices } from "../../../application/health";
import { UserDataServices } from "../../../application/user-data/contracts";
import { ExchangeServices } from "../../../application/exchange/contracts";
import { notFoundError, domainError } from "../../../application/errors";
import { handleRequest } from "../router";

const mockMarketDataServices = {
  requestCandlesticks: vi.fn(),
  createDatasetSnapshot: vi.fn(),
  getDatasetSnapshot: vi.fn(),
  getCandles: vi.fn(),
  getRecentCandles: vi.fn(),
  discoverMarkets: vi.fn(),
  inspectCoverage: vi.fn(),
  getTicker: vi.fn(),
  getOrderBook: vi.fn(),
  getTradeAnnotation: vi.fn(),
};

const TestMarketDataLayer = Layer.succeed(
  MarketDataServices,
  mockMarketDataServices as unknown as Context.Tag.Service<typeof MarketDataServices>
);

const TestHealthLayer = Layer.succeed(HealthServices, {
  check: () =>
    Effect.succeed({
      status: "ok" as const,
      timestamp: new Date("2026-01-01T00:00:00.000Z"),
      uptime: 123,
      postgres: true,
    }),
});

const mockUserDataServices: Context.Tag.Service<typeof UserDataServices> = {
  getClearinghouseState: vi.fn(),
  getSpotClearinghouseState: vi.fn(),
  getOpenOrders: vi.fn(),
  getFrontendOpenOrders: vi.fn(),
  getMeta: vi.fn(),
  getHistoricalOrders: vi.fn(),
  getUserFills: vi.fn(),
};

const TestUserDataLayer = Layer.succeed(UserDataServices, mockUserDataServices);

// Exchange layer is required by router.ts handleRequest but unused in market-data tests
const mockExchangeServices: Context.Tag.Service<typeof ExchangeServices> = {
  placeOrder: vi.fn(),
  updateLeverageAndMargin: vi.fn(),
  cancelOrders: vi.fn(),
};
const TestExchangeLayer = Layer.succeed(ExchangeServices, mockExchangeServices);

const runRequest = (path: string, method = "GET") =>
  Effect.runPromise(
    handleRequest(new Request(`http://localhost${path}`, { method })).pipe(
      Effect.provide(
        Layer.mergeAll(TestMarketDataLayer, TestHealthLayer, TestUserDataLayer, TestExchangeLayer)
      )
    )
  );

const expectHttpFailure = async (
  promise: Promise<unknown>,
  expected: { status: number; message: string }
) => {
  const result = await promise;

  // handleRequest returns Response objects for all outcomes (including errors)
  if (result instanceof Response) {
    const body = await result.json();
    expect({ status: result.status, message: body.error ?? "Unknown error" }).toEqual(expected);
    return;
  }

  // Fallback: check for thrown errors
  if (result && typeof result === "object") {
    const candidate = result as { status?: unknown; message?: unknown };
    if (typeof candidate.status === "number" && typeof candidate.message === "string") {
      expect({ status: candidate.status, message: candidate.message }).toEqual(expected);
      return;
    }
  }

  throw new Error(`Expected HTTP error but got: ${JSON.stringify(result)}`);
};

describe("HTTP Market Data Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockMarketDataServices.discoverMarkets.mockReturnValue(Effect.succeed({ universe: [] }));
    mockMarketDataServices.getCandles.mockReturnValue(
      Effect.succeed({
        candles: [],
        provenance: "QuestDB",
        coverage: {
          hasData: true,
          rowCount: 1,
          expectedCount: 1,
          fullCoverage: true,
          missingWindows: [],
        },
      })
    );
    mockMarketDataServices.getRecentCandles.mockReturnValue(
      Effect.succeed({
        candles: [],
        provenance: "Hyperliquid Snapshot (Recent via Backend)",
        coverage: {
          hasData: true,
          rowCount: 1,
          expectedCount: 1,
          fullCoverage: true,
          missingWindows: [],
        },
      })
    );
    mockMarketDataServices.inspectCoverage.mockReturnValue(
      Effect.succeed({
        hasData: true,
        rowCount: 10,
        expectedCount: 10,
        fullCoverage: true,
        missingWindows: [],
      })
    );
    mockMarketDataServices.getTicker.mockReturnValue(
      Effect.succeed({
        symbol: "BTC",
        mid: 100000,
        markPx: 100100,
        midPx: 100000,
        prevDayPx: 98000,
        dayNtlVlm: 12345,
        openInterest: 500000,
        funding: 0.0001,
      })
    );
    mockMarketDataServices.getOrderBook.mockReturnValue(
      Effect.succeed({ symbol: "BTC", orderbook: null })
    );
    mockMarketDataServices.getTradeAnnotation.mockReturnValue(
      Effect.succeed({ symbol: "BTC", annotation: null })
    );
  });

  it("returns 404 for unknown route", async () => {
    await expectHttpFailure(runRequest("/api/unknown"), {
      status: 404,
      message: "Not found",
    });
  });

  it("returns 405 for unsupported method", async () => {
    await expectHttpFailure(runRequest("/api/markets", "POST"), {
      status: 405,
      message: "Method POST not allowed",
    });
  });

  it("routes /api/markets to discoverMarkets", async () => {
    const response = await runRequest("/api/markets");
    expect(response.status).toBe(200);
    expect(mockMarketDataServices.discoverMarkets).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toEqual({ universe: [] });
  });

  it("routes /api/health preserving status payload shape", async () => {
    const response = await runRequest("/api/health");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "ok",
      timestamp: "2026-01-01T00:00:00.000Z",
      uptime: 123,
      postgres: true,
    });
  });

  it("accepts app interval set on /api/candles", async () => {
    const response = await runRequest("/api/candles?symbol=BTC&interval=3m&limit=50");
    expect(response.status).toBe(200);
    expect(mockMarketDataServices.getCandles).toHaveBeenCalledWith(
      expect.objectContaining({
        symbol: "BTC",
        timeframe: "3m",
        limit: 50,
      })
    );
  });

  it("returns 400 for invalid candle query", async () => {
    await expectHttpFailure(runRequest("/api/candles?interval=1m"), {
      status: 400,
      message: "Missing required query parameter: symbol",
    });
  });

  it("routes /api/candles/recent to recent snapshot lane", async () => {
    const response = await runRequest("/api/candles/recent?symbol=BTC&interval=1m&limit=200");
    expect(response.status).toBe(200);
    expect(mockMarketDataServices.getRecentCandles).toHaveBeenCalledWith(
      expect.objectContaining({
        symbol: "BTC",
        timeframe: "1m",
        limit: 200,
      })
    );
  });

  it("rejects malformed integer suffixes for candle limit", async () => {
    await expectHttpFailure(runRequest("/api/candles?symbol=BTC&interval=1m&limit=2abc"), {
      status: 400,
      message: "Invalid integer for limit: 2abc",
    });
  });

  it("routes /api/ticker preserving app-facing metrics fields", async () => {
    const response = await runRequest("/api/ticker?symbol=BTC");

    expect(response.status).toBe(200);
    expect(mockMarketDataServices.getTicker).toHaveBeenCalledWith("BTC");
    await expect(response.json()).resolves.toEqual({
      symbol: "BTC",
      mid: 100000,
      markPx: 100100,
      midPx: 100000,
      prevDayPx: 98000,
      dayNtlVlm: 12345,
      openInterest: 500000,
      funding: 0.0001,
    });
  });

  it("supports nSigFigs alias for orderbook precision", async () => {
    const response = await runRequest("/api/orderbook?symbol=BTC&nSigFigs=4");

    expect(response.status).toBe(200);
    expect(mockMarketDataServices.getOrderBook).toHaveBeenCalledWith("BTC", 4);
  });

  it("rejects unsupported orderbook precision values", async () => {
    await expectHttpFailure(runRequest("/api/orderbook?symbol=BTC&nSigFigs=6"), {
      status: 400,
      message: "Invalid nSigFigs: 6. Supported values are 2, 3, 4, 5.",
    });
  });

  it("rejects malformed orderbook precision values", async () => {
    await expectHttpFailure(runRequest("/api/orderbook?symbol=BTC&nSigFigs=2abc"), {
      status: 400,
      message: "Invalid nSigFigs: 2abc. Supported values are 2, 3, 4, 5.",
    });
  });

  it("requires coverage time window", async () => {
    await expectHttpFailure(runRequest("/api/candles/coverage?symbol=BTC&interval=1m"), {
      status: 400,
      message: "start_time and end_time are required",
    });
  });

  it("maps ticker not found errors to 404", async () => {
    mockMarketDataServices.getTicker.mockReturnValue(
      Effect.fail(notFoundError("Symbol not found: XRP"))
    );

    await expectHttpFailure(runRequest("/api/ticker?symbol=XRP"), {
      status: 404,
      message: "Symbol not found: XRP",
    });
  });

  it("maps upstream ticker failures to 502", async () => {
    mockMarketDataServices.getTicker.mockReturnValue(
      Effect.fail(domainError("INTERNAL_ERROR", "Upstream provider unavailable"))
    );

    await expectHttpFailure(runRequest("/api/ticker?symbol=BTC"), {
      status: 502,
      message: "Upstream provider unavailable",
    });
  });
});
