import { beforeEach, describe, expect, it, vi } from "vitest";
import { type Context, Effect, Layer } from "effect";
import { MarketDataService } from "../../../application/market-data/contracts";
import { HealthService } from "../../../application/health";
import { UserDataService } from "../../../application/user-data/contracts";
import { ExchangeService } from "../../../application/exchange/contracts";
import { NotFoundError, InternalError } from "../../../application/errors";
import { handleRequest } from "../router";
import { TestRouteEnvLayer } from "./route-test-layer";

const mockMarketDataService = {
  getCandles: vi.fn<Context.Service.Shape<typeof MarketDataService>["getCandles"]>(),
  getRecentCandles: vi.fn<Context.Service.Shape<typeof MarketDataService>["getRecentCandles"]>(),
  discoverMarkets: vi.fn<Context.Service.Shape<typeof MarketDataService>["discoverMarkets"]>(),
  getTicker: vi.fn<Context.Service.Shape<typeof MarketDataService>["getTicker"]>(),
  getOrderBook: vi.fn<Context.Service.Shape<typeof MarketDataService>["getOrderBook"]>(),
  getTradeAnnotation:
    vi.fn<Context.Service.Shape<typeof MarketDataService>["getTradeAnnotation"]>(),
};

const TestMarketDataLayer = Layer.succeed(MarketDataService, mockMarketDataService);

const TestHealthLayer = Layer.succeed(HealthService, {
  check: () =>
    Effect.succeed({
      status: "ok" as const,
      timestamp: new Date("2026-01-01T00:00:00.000Z"),
      uptime: 123,
      postgres: true,
    }),
});

const mockUserDataService = {
  getClearinghouseState:
    vi.fn<Context.Service.Shape<typeof UserDataService>["getClearinghouseState"]>(),
  getSpotClearinghouseState:
    vi.fn<Context.Service.Shape<typeof UserDataService>["getSpotClearinghouseState"]>(),
  getOpenOrders: vi.fn<Context.Service.Shape<typeof UserDataService>["getOpenOrders"]>(),
  getFrontendOpenOrders:
    vi.fn<Context.Service.Shape<typeof UserDataService>["getFrontendOpenOrders"]>(),
  getMeta: vi.fn<Context.Service.Shape<typeof UserDataService>["getMeta"]>(),
  getHistoricalOrders:
    vi.fn<Context.Service.Shape<typeof UserDataService>["getHistoricalOrders"]>(),
  getUserFills: vi.fn<Context.Service.Shape<typeof UserDataService>["getUserFills"]>(),
};

const TestUserDataLayer = Layer.mock(UserDataService, mockUserDataService);

// Exchange layer is required by router.ts handleRequest but unused in market-data tests
const mockExchangeService = {
  placeOrder: vi.fn<Context.Service.Shape<typeof ExchangeService>["placeOrder"]>(),
  updateLeverageAndMargin:
    vi.fn<Context.Service.Shape<typeof ExchangeService>["updateLeverageAndMargin"]>(),
  cancelOrders: vi.fn<Context.Service.Shape<typeof ExchangeService>["cancelOrders"]>(),
};
const TestExchangeLayer = Layer.succeed(ExchangeService, mockExchangeService);

const runRequest = (path: string, method = "GET") =>
  Effect.runPromise(
    handleRequest(new Request(`http://localhost${path}`, { method })).pipe(
      Effect.provide(
        Layer.mergeAll(
          TestMarketDataLayer,
          TestHealthLayer,
          TestUserDataLayer,
          TestExchangeLayer,
          TestRouteEnvLayer,
        ),
      ),
    ),
  );

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const errorMessage = (body: unknown): unknown => {
  if (!isRecord(body)) return "Unknown error";
  return body["error"] ?? "Unknown error";
};

const expectHttpFailure = async (
  promise: Promise<unknown>,
  expected: { status: number; message: string },
) => {
  const result = await promise;

  // handleRequest returns Response objects for all outcomes (including errors)
  if (result instanceof Response) {
    const body: unknown = await result.json();
    expect(result.status).toBe(expected.status);
    expect(String(errorMessage(body))).toContain(expected.message);
    if (!isRecord(body)) throw new Error("Expected a JSON error body");
    expect(typeof body["error"]).toBe("string");
    return;
  }

  // Fallback: check for thrown errors
  if (isRecord(result)) {
    const candidate = result;
    if (typeof candidate.status === "number" && typeof candidate.message === "string") {
      expect(candidate.status).toBe(expected.status);
      expect(candidate.message).toContain(expected.message);
      expect(typeof candidate.retryable).toBe("boolean");
      return;
    }
  }

  throw new Error(`Expected HTTP error but got: ${JSON.stringify(result)}`);
};

describe("HTTP Market Data Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockMarketDataService.discoverMarkets.mockReturnValue(Effect.succeed([]));
    mockMarketDataService.getCandles.mockReturnValue(
      Effect.succeed({
        candles: [],
        provenance: "",
        coverage: {
          hasData: true,
          rowCount: 1,
          expectedCount: 1,
          fullCoverage: true,
          missingWindows: [],
        },
      }),
    );
    mockMarketDataService.getRecentCandles.mockReturnValue(
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
      }),
    );
    mockMarketDataService.getTicker.mockReturnValue(
      Effect.succeed({
        symbol: "BTC",
        mid: 100000,
        markPx: 100100,
        midPx: 100000,
        prevDayPx: 98000,
        dayNtlVlm: 12345,
        openInterest: 500000,
        funding: 0.0001,
      }),
    );
    mockMarketDataService.getOrderBook.mockReturnValue(
      Effect.succeed({ symbol: "BTC", orderbook: null }),
    );
    mockMarketDataService.getTradeAnnotation.mockReturnValue(
      Effect.succeed({ symbol: "BTC", annotation: null }),
    );
  });

  it("returns 404 for unknown route", async () => {
    expect.hasAssertions();
    await expectHttpFailure(runRequest("/api/unknown"), {
      status: 404,
      message: "Not found",
    });
  });

  it("returns 405 for unsupported method", async () => {
    expect.hasAssertions();
    await expectHttpFailure(runRequest("/api/markets", "POST"), {
      status: 405,
      message: "Method POST not allowed",
    });
  });

  it("routes /api/markets to discoverMarkets", async () => {
    const response = await runRequest("/api/markets");
    expect(response.status).toBe(200);
    expect(mockMarketDataService.discoverMarkets).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toEqual({ data: [] });
  });

  it("routes /api/health preserving status payload shape", async () => {
    const response = await runRequest("/api/health");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: {
        status: "ok",
        timestamp: "2026-01-01T00:00:00.000Z",
        uptime: 123,
        postgres: true,
      },
    });
  });

  it("accepts app interval set on /api/candles", async () => {
    const response = await runRequest("/api/candles?symbol=BTC&interval=3m&limit=50");
    expect(response.status).toBe(200);
    expect(mockMarketDataService.getCandles).toHaveBeenCalledWith(
      expect.objectContaining({
        symbol: "BTC",
        timeframe: "3m",
        limit: 50,
      }),
    );
  });

  it("returns 400 for invalid candle query", async () => {
    expect.hasAssertions();
    await expectHttpFailure(runRequest("/api/candles?interval=1m"), {
      status: 400,
      message: "Missing required query parameter: symbol",
    });
  });

  it("routes /api/candles/recent to recent snapshot lane", async () => {
    const response = await runRequest("/api/candles/recent?symbol=BTC&interval=1m&limit=200");
    expect(response.status).toBe(200);
    expect(mockMarketDataService.getRecentCandles).toHaveBeenCalledWith(
      expect.objectContaining({
        symbol: "BTC",
        timeframe: "1m",
        limit: 200,
      }),
    );
  });

  it("rejects malformed integer suffixes for candle limit", async () => {
    expect.hasAssertions();
    await expectHttpFailure(runRequest("/api/candles?symbol=BTC&interval=1m&limit=2abc"), {
      status: 400,
      message: "limit",
    });
  });

  it("rejects an unparseable start_time with a 400 naming the field", async () => {
    expect.hasAssertions();
    await expectHttpFailure(
      runRequest("/api/candles?symbol=BTC&interval=1m&start_time=not-a-date"),
      { status: 400, message: "start_time" },
    );
  });

  it("rejects a missing interval with a 400 naming the field", async () => {
    expect.hasAssertions();
    await expectHttpFailure(runRequest("/api/candles?symbol=BTC"), {
      status: 400,
      message: "interval",
    });
  });

  it("defaults the exchange when it is omitted", async () => {
    const response = await runRequest("/api/candles?symbol=BTC&interval=1m");

    expect(response.status).toBe(200);
    expect(mockMarketDataService.getCandles).toHaveBeenCalledWith(
      expect.objectContaining({ exchange: "Hyperliquid" }),
    );
  });

  it("routes /api/ticker preserving app-facing metrics fields", async () => {
    const response = await runRequest("/api/ticker?symbol=BTC");

    expect(response.status).toBe(200);
    expect(mockMarketDataService.getTicker).toHaveBeenCalledWith("BTC");
    await expect(response.json()).resolves.toEqual({
      data: {
        symbol: "BTC",
        mid: 100000,
        markPx: 100100,
        midPx: 100000,
        prevDayPx: 98000,
        dayNtlVlm: 12345,
        openInterest: 500000,
        funding: 0.0001,
      },
    });
  });

  it("supports nSigFigs alias for orderbook precision", async () => {
    const response = await runRequest("/api/orderbook?symbol=BTC&nSigFigs=4");

    expect(response.status).toBe(200);
    expect(mockMarketDataService.getOrderBook).toHaveBeenCalledWith("BTC", 4);
  });

  it("defaults to null nSigFigs (full precision) when no nSigFigs param", async () => {
    const response = await runRequest("/api/orderbook?symbol=BTC");

    expect(response.status).toBe(200);
    expect(mockMarketDataService.getOrderBook).toHaveBeenCalledWith("BTC", null);
  });

  it("rejects unsupported orderbook precision values", async () => {
    expect.hasAssertions();
    await expectHttpFailure(runRequest("/api/orderbook?symbol=BTC&nSigFigs=6"), {
      status: 400,
      message: "nSigFigs",
    });
  });

  it("rejects malformed orderbook precision values", async () => {
    expect.hasAssertions();
    await expectHttpFailure(runRequest("/api/orderbook?symbol=BTC&nSigFigs=2abc"), {
      status: 400,
      message: "nSigFigs",
    });
  });

  it("maps ticker not found errors to 404", async () => {
    expect.hasAssertions();
    mockMarketDataService.getTicker.mockReturnValue(
      Effect.fail(new NotFoundError({ message: "Symbol not found: XRP" })),
    );

    await expectHttpFailure(runRequest("/api/ticker?symbol=XRP"), {
      status: 404,
      message: "Symbol not found: XRP",
    });
  });

  it("maps upstream ticker failures to 502", async () => {
    expect.hasAssertions();
    mockMarketDataService.getTicker.mockReturnValue(
      Effect.fail(new InternalError({ message: "Upstream provider unavailable" })),
    );

    await expectHttpFailure(runRequest("/api/ticker?symbol=BTC"), {
      status: 502,
      message: "Upstream provider unavailable",
    });
  });
});
