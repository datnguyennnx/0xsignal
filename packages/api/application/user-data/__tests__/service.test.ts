import { describe, expect, it, vi, beforeAll } from "vitest";
import { Effect, Layer } from "effect";
import { HyperliquidClient } from "../../../infrastructure/data-sources/hyperliquid/client";
import { UserDataServices } from "../contracts";
import { UserDataServicesLive } from "../service";

/* ─── Fixtures ─── */

const WALLET = "0xabc123";

const mockClearinghouseState = {
  marginSummary: {
    accountValue: "50000.00",
    totalNtlPos: "30000.00",
    totalRawUsd: "20000.00",
    totalMarginUsed: "15000.00",
  },
  crossMarginSummary: {
    accountValue: "50000.00",
    totalNtlPos: "30000.00",
    totalRawUsd: "20000.00",
    totalMarginUsed: "15000.00",
  },
  crossMaintenanceMarginUsed: "5000.00",
  withdrawable: "5000.00",
  assetPositions: [
    {
      type: "oneWay" as const,
      position: {
        coin: "BTC",
        szi: "0.5",
        leverage: { type: "cross" as const, value: 10 },
        entryPx: "60000",
        positionValue: "30000",
        unrealizedPnl: "1000",
        returnOnEquity: "0.05",
        liquidationPx: "55000",
        marginUsed: "3000",
        maxLeverage: 50,
        cumFunding: { allTime: "50", sinceOpen: "10", sinceChange: "10" },
      },
    },
  ],
  time: Date.now(),
};

const mockOpenOrders = [
  {
    coin: "ETH",
    side: "B" as const,
    limitPx: "2500",
    sz: "1.5",
    oid: 1001,
    timestamp: Date.now() - 60000,
    origSz: "1.5",
  },
];

const mockHistoricalOrders = [
  {
    order: {
      coin: "BTC",
      side: "A" as const,
      limitPx: "62000",
      sz: "0.1",
      oid: 5001,
      timestamp: Date.now() - 3600000,
      origSz: "0.1",
      orderType: { limit: {} },
      triggerCondition: "",
      triggerPx: "",
      isTrigger: false,
      reduceOnly: false,
      isPositionTpsl: false,
      children: [],
      tif: "Gtc" as const,
      cloid: null,
    },
    status: "filled" as const,
    statusTimestamp: Date.now() - 3500000,
  },
];

const mockUserFills = [
  {
    coin: "BTC",
    side: "B" as const,
    px: "59000",
    sz: "0.2",
    time: Date.now() - 7200000,
    startPosition: "0",
    dir: "Open Long",
    closedPnl: "150",
    hash: "0xtx1" as `0x${string}`,
    oid: 3001,
    crossed: true,
    fee: "5.90",
    tid: 1,
    feeToken: "USDC",
    twapId: null,
  },
];

/* ─── Mock HyperliquidClient ─── */

const makeMockLayer = (
  overrides?: Partial<{
    clearinghouseState: () => Promise<unknown>;
    openOrders: () => Promise<unknown>;
    historicalOrders: () => Promise<unknown>;
    userFills: () => Promise<unknown>;
  }>
) => {
  const client = HyperliquidClient.of({
    info: {
      clearinghouseState: vi
        .fn()
        .mockImplementation(
          overrides?.clearinghouseState ?? (() => Promise.resolve(mockClearinghouseState))
        ),
      openOrders: vi
        .fn()
        .mockImplementation(overrides?.openOrders ?? (() => Promise.resolve(mockOpenOrders))),
      historicalOrders: vi
        .fn()
        .mockImplementation(
          overrides?.historicalOrders ?? (() => Promise.resolve(mockHistoricalOrders))
        ),
      userFills: vi
        .fn()
        .mockImplementation(overrides?.userFills ?? (() => Promise.resolve(mockUserFills))),
    } as unknown as (typeof HyperliquidClient.Service)["info"],
  });
  return Layer.succeed(HyperliquidClient, client);
};

const makeTestLayer = (mockOverrides?: Parameters<typeof makeMockLayer>[0]) =>
  UserDataServicesLive.pipe(Layer.provideMerge(makeMockLayer(mockOverrides)));

/* ─── Tests ─── */

describe("UserDataServices", () => {
  beforeAll(() => {
    process.env.HYPERLIQUID_WALLET_ADDRESS = WALLET;
  });

  describe("getClearinghouseState", () => {
    it("returns clearinghouse state with margin summary and positions", async () => {
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* UserDataServices;
          return yield* svc.getClearinghouseState();
        }).pipe(Effect.provide(makeTestLayer()))
      );

      const data = result as typeof mockClearinghouseState;
      expect(data.marginSummary.accountValue).toBe("50000.00");
      expect(data.assetPositions).toHaveLength(1);
      expect(data.assetPositions[0].position.coin).toBe("BTC");
    });

    it("returns typed error when SDK call fails", async () => {
      const errorLayer = makeTestLayer({
        clearinghouseState: () => Promise.reject(new Error("API error")),
      });

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* UserDataServices;
          return yield* svc.getClearinghouseState();
        })
          .pipe(Effect.provide(errorLayer))
          .pipe(Effect.flip)
      );

      expect(result).toHaveProperty("code", "INTERNAL_ERROR");
      expect(result).toHaveProperty("message", "Failed to fetch clearinghouse state");
    });
  });

  describe("getOpenOrders", () => {
    it("returns open orders array", async () => {
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* UserDataServices;
          return yield* svc.getOpenOrders();
        }).pipe(Effect.provide(makeTestLayer()))
      );

      const orders = result as typeof mockOpenOrders;
      expect(orders).toHaveLength(1);
      expect(orders[0].coin).toBe("ETH");
      expect(orders[0].side).toBe("B");
    });

    it("returns typed error when SDK call fails", async () => {
      const errorLayer = makeTestLayer({
        openOrders: () => Promise.reject(new Error("Network error")),
      });

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* UserDataServices;
          return yield* svc.getOpenOrders();
        })
          .pipe(Effect.provide(errorLayer))
          .pipe(Effect.flip)
      );

      expect(result).toHaveProperty("code", "INTERNAL_ERROR");
      expect(result).toHaveProperty("message", "Failed to fetch open orders");
    });
  });

  describe("getHistoricalOrders", () => {
    it("returns historical orders with status", async () => {
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* UserDataServices;
          return yield* svc.getHistoricalOrders();
        }).pipe(Effect.provide(makeTestLayer()))
      );

      const orders = result as typeof mockHistoricalOrders;
      expect(orders).toHaveLength(1);
      expect(orders[0].status).toBe("filled");
      expect(orders[0].order.coin).toBe("BTC");
    });
  });

  describe("getUserFills", () => {
    it("returns user fills (trade history)", async () => {
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* UserDataServices;
          return yield* svc.getUserFills();
        }).pipe(Effect.provide(makeTestLayer()))
      );

      const fills = result as typeof mockUserFills;
      expect(fills).toHaveLength(1);
      expect(fills[0].coin).toBe("BTC");
      expect(fills[0].side).toBe("B");
      expect(fills[0].closedPnl).toBe("150");
    });
  });
});
