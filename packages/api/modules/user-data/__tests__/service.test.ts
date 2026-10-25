import { describe, expect, it, vi, beforeEach } from "vitest";
import { Effect, Layer } from "effect";
import { HttpTransport, InfoClient } from "@nktkas/hyperliquid";
import { HyperliquidClient } from "../../../integrations/hyperliquid/data-sources/hyperliquid-client";
import { UserDataService } from "../index";
import { userDataServiceLayer } from "../service";

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

const mockHistoricalOrders: Awaited<ReturnType<InfoClient["historicalOrders"]>> = [
  {
    order: {
      coin: "BTC",
      side: "A" as const,
      limitPx: "62000",
      sz: "0.1",
      oid: 5001,
      timestamp: Date.now() - 3600000,
      origSz: "0.1",
      orderType: "Limit",
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

const mockFrontendOpenOrders: Awaited<ReturnType<InfoClient["frontendOpenOrders"]>> = [
  {
    coin: "BTC",
    side: "B" as const,
    sz: "1.0",
    limitPx: "60000",
    oid: 2001,
    timestamp: Date.now() - 30000,
    origSz: "1.0",
    orderType: "Limit",
    triggerCondition: "",
    triggerPx: "",
    isTrigger: false,
    isPositionTpsl: false,
    reduceOnly: false,
    children: [
      {
        coin: "BTC",
        side: "A" as const,
        sz: "1.0",
        limitPx: "65000",
        oid: 2002,
        timestamp: Date.now() - 30000,
        origSz: "1.0",
        orderType: "Stop Market",
        triggerCondition: "above",
        triggerPx: "65000",
        isTrigger: true,
        isPositionTpsl: false,
        reduceOnly: true,
        children: [],
        tif: null,
        cloid: null,
      },
      {
        coin: "BTC",
        side: "A" as const,
        sz: "1.0",
        limitPx: "55000",
        oid: 2003,
        timestamp: Date.now() - 30000,
        origSz: "1.0",
        orderType: "Stop Market",
        triggerCondition: "below",
        triggerPx: "55000",
        isTrigger: true,
        isPositionTpsl: false,
        reduceOnly: true,
        children: [],
        tif: null,
        cloid: null,
      },
    ],
    tif: "Gtc" as const,
    cloid: null,
  },
];

const mockSpotClearinghouseState = {
  balances: [
    {
      coin: "USDC",
      token: 0,
      total: "10000.00",
      hold: "500.00",
      entryNtl: "0",
    },
    {
      coin: "ETH",
      token: 1,
      total: "2.5",
      hold: "0",
      entryNtl: "5000",
    },
  ],
};

const mockMeta = {
  universe: [
    { name: "BTC", szDecimals: 5, maxLeverage: 50, marginTableId: 0 },
    { name: "ETH", szDecimals: 4, maxLeverage: 50, marginTableId: 0 },
    { name: "SOL", szDecimals: 3, maxLeverage: 30, marginTableId: 0 },
  ],
  marginTables: [],
  collateralToken: 0,
};

const makePortfolio = (): Awaited<ReturnType<InfoClient["portfolio"]>> => {
  const data = { accountValueHistory: [], pnlHistory: [], vlm: "0" };
  return [
    ["day", data],
    ["week", data],
    ["month", data],
    ["allTime", data],
    ["perpDay", data],
    ["perpWeek", data],
    ["perpMonth", data],
    ["perpAllTime", data],
  ];
};

type InfoMethod =
  | "clearinghouseState"
  | "openOrders"
  | "historicalOrders"
  | "userFills"
  | "frontendOpenOrders"
  | "spotClearinghouseState"
  | "meta"
  | "portfolio"
  | "userVaultEquities"
  | "userFunding";

const makeMockLayer = (overrides?: Partial<Pick<InfoClient, InfoMethod>>) => {
  const info = {
    clearinghouseState: vi
      .fn<InfoClient["clearinghouseState"]>()
      .mockImplementation(
        overrides?.clearinghouseState ?? (() => Promise.resolve(mockClearinghouseState)),
      ),
    openOrders: vi
      .fn<InfoClient["openOrders"]>()
      .mockImplementation(overrides?.openOrders ?? (() => Promise.resolve(mockOpenOrders))),
    historicalOrders: vi
      .fn<InfoClient["historicalOrders"]>()
      .mockImplementation(
        overrides?.historicalOrders ?? (() => Promise.resolve(mockHistoricalOrders)),
      ),
    userFills: vi
      .fn<InfoClient["userFills"]>()
      .mockImplementation(overrides?.userFills ?? (() => Promise.resolve(mockUserFills))),
    frontendOpenOrders: vi
      .fn<InfoClient["frontendOpenOrders"]>()
      .mockImplementation(
        overrides?.frontendOpenOrders ?? (() => Promise.resolve(mockFrontendOpenOrders)),
      ),
    spotClearinghouseState: vi
      .fn<InfoClient["spotClearinghouseState"]>()
      .mockImplementation(
        overrides?.spotClearinghouseState ?? (() => Promise.resolve(mockSpotClearinghouseState)),
      ),
    meta: vi
      .fn<InfoClient["meta"]>()
      .mockImplementation(overrides?.meta ?? (() => Promise.resolve(mockMeta))),
    portfolio: vi
      .fn<InfoClient["portfolio"]>()
      .mockImplementation(overrides?.portfolio ?? (() => Promise.resolve(makePortfolio()))),
    userVaultEquities: vi
      .fn<InfoClient["userVaultEquities"]>()
      .mockImplementation(overrides?.userVaultEquities ?? (() => Promise.resolve([]))),
    userFunding: vi
      .fn<InfoClient["userFunding"]>()
      .mockImplementation(overrides?.userFunding ?? (() => Promise.resolve([]))),
  };
  const client = HyperliquidClient.of({
    info: Object.assign(new InfoClient({ transport: new HttpTransport() }), info),
  });
  return Layer.succeed(HyperliquidClient, client);
};

const makeTestLayer = (mockOverrides?: Parameters<typeof makeMockLayer>[0]) =>
  userDataServiceLayer.pipe(Layer.provideMerge(makeMockLayer(mockOverrides)));

describe("UserDataService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getClearinghouseState", () => {
    it("returns clearinghouse state with margin summary and positions", async () => {
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* UserDataService;
          return yield* svc.getClearinghouseState(WALLET);
        }).pipe(Effect.provide(makeTestLayer())),
      );

      expect(result.marginSummary.accountValue).toBe("50000.00");
      expect(result.assetPositions).toHaveLength(1);
      expect(result.assetPositions[0].position.coin).toBe("BTC");
    });

    it("returns typed error when SDK call fails", async () => {
      const errorLayer = makeTestLayer({
        clearinghouseState: () => Promise.reject(new Error("API error")),
      });

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* UserDataService;
          return yield* svc.getClearinghouseState(WALLET);
        })
          .pipe(Effect.provide(errorLayer))
          .pipe(Effect.flip),
      );

      expect(result).toHaveProperty("_tag", "InternalError");
      expect(result).toHaveProperty("message", "clearinghouseState failed");
    });
  });

  describe("getOpenOrders", () => {
    it("returns open orders array", async () => {
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* UserDataService;
          return yield* svc.getOpenOrders(WALLET);
        }).pipe(Effect.provide(makeTestLayer())),
      );

      expect(result).toHaveLength(1);
      expect(result[0].coin).toBe("ETH");
      expect(result[0].side).toBe("B");
    });

    it("returns typed error when SDK call fails", async () => {
      const errorLayer = makeTestLayer({
        openOrders: () => Promise.reject(new Error("Network error")),
      });

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* UserDataService;
          return yield* svc.getOpenOrders(WALLET);
        })
          .pipe(Effect.provide(errorLayer))
          .pipe(Effect.flip),
      );

      expect(result).toHaveProperty("_tag", "InternalError");
      expect(result).toHaveProperty("message", "openOrders failed");
    });
  });

  describe("getHistoricalOrders", () => {
    it("returns historical orders with status", async () => {
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* UserDataService;
          return yield* svc.getHistoricalOrders(WALLET);
        }).pipe(Effect.provide(makeTestLayer())),
      );

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe("filled");
      expect(result[0].order.coin).toBe("BTC");
    });
  });

  describe("getUserFills", () => {
    it("returns user fills (trade history)", async () => {
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* UserDataService;
          return yield* svc.getUserFills(WALLET);
        }).pipe(Effect.provide(makeTestLayer())),
      );

      expect(result).toHaveLength(1);
      expect(result[0].coin).toBe("BTC");
      expect(result[0].side).toBe("B");
      expect(result[0].closedPnl).toBe("150");
    });
  });

  describe("getFrontendOpenOrders", () => {
    it("returns frontend open orders with children array", async () => {
      const layer = makeTestLayer({
        frontendOpenOrders: () => Promise.resolve(mockFrontendOpenOrders),
      });

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* UserDataService;
          return yield* svc.getFrontendOpenOrders(WALLET);
        }).pipe(Effect.provide(layer)),
      );

      expect(result).toHaveLength(1);
      expect(result[0].oid).toBe(2001);
      expect(result[0].children).toHaveLength(2);
      expect(result[0].children[0].oid).toBe(2002);
      expect(result[0].children[0].reduceOnly).toBe(true);
      expect(result[0].children[1].oid).toBe(2003);
      expect(result[0].children[1].reduceOnly).toBe(true);
    });

    it("returns typed error when SDK call fails", async () => {
      const errorLayer = makeTestLayer({
        frontendOpenOrders: () => Promise.reject(new Error("API error")),
      });

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* UserDataService;
          return yield* svc.getFrontendOpenOrders(WALLET);
        })
          .pipe(Effect.provide(errorLayer))
          .pipe(Effect.flip),
      );

      expect(result).toHaveProperty("_tag", "InternalError");
      expect(result).toHaveProperty("message", "frontendOpenOrders failed");
    });
  });

  describe("getSpotClearinghouseState", () => {
    it("returns balances with USDC balance for order form fallback", async () => {
      const layer = makeTestLayer({
        spotClearinghouseState: () => Promise.resolve(mockSpotClearinghouseState),
      });

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* UserDataService;
          return yield* svc.getSpotClearinghouseState(WALLET);
        }).pipe(Effect.provide(layer)),
      );

      expect(result.balances).toHaveLength(2);

      const usdc = result.balances.find((b: { coin: string }) => b.coin === "USDC");
      expect(usdc).toBeDefined();
      expect(usdc?.total).toBe("10000.00");
      expect(usdc?.hold).toBe("500.00");
    });

    it("returns typed error when SDK call fails", async () => {
      const errorLayer = makeTestLayer({
        spotClearinghouseState: () => Promise.reject(new Error("Network error")),
      });

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* UserDataService;
          return yield* svc.getSpotClearinghouseState(WALLET);
        })
          .pipe(Effect.provide(errorLayer))
          .pipe(Effect.flip),
      );

      expect(result).toHaveProperty("_tag", "InternalError");
      expect(result).toHaveProperty("message", "spotClearinghouseState failed");
    });
  });

  describe("getMeta", () => {
    it("returns universe with szDecimals and maxLeverage for size truncation", async () => {
      const layer = makeTestLayer({
        meta: () => Promise.resolve(mockMeta),
      });

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* UserDataService;
          return yield* svc.getMeta();
        }).pipe(Effect.provide(layer)),
      );

      expect(result).toHaveProperty("universe", mockMeta.universe);
      expect(result).toHaveProperty("universe.0.name", "BTC");
      expect(result).toHaveProperty("universe.0.szDecimals", 5);
      expect(result).toHaveProperty("universe.0.maxLeverage", 50);
    });

    it("returns typed error when SDK call fails", async () => {
      const errorLayer = makeTestLayer({
        meta: () => Promise.reject(new Error("Failed to fetch")),
      });

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* UserDataService;
          return yield* svc.getMeta();
        })
          .pipe(Effect.provide(errorLayer))
          .pipe(Effect.flip),
      );

      expect(result).toHaveProperty("_tag", "InternalError");
      expect(result).toHaveProperty("message", "meta failed");
    });
  });

  describe("getPortfolio", () => {
    it("fetches portfolio using wallet address", async () => {
      const mockPortfolio = makePortfolio();
      const layer = makeTestLayer({
        meta: () => Promise.resolve(mockMeta),
        portfolio: () => Promise.resolve(mockPortfolio),
      });

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* UserDataService;
          return yield* svc.getPortfolio(WALLET);
        }).pipe(Effect.provide(layer)),
      );

      expect(result).toEqual(mockPortfolio);
    });
  });

  describe("getUserVaultEquities", () => {
    it("fetches vault equities using wallet address", async () => {
      const mockEquities: Awaited<ReturnType<InfoClient["userVaultEquities"]>> = [];
      const layer = makeTestLayer({
        userVaultEquities: () => Promise.resolve(mockEquities),
      });

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* UserDataService;
          return yield* svc.getUserVaultEquities(WALLET);
        }).pipe(Effect.provide(layer)),
      );

      expect(result).toEqual(mockEquities);
    });
  });

  describe("getUserFunding", () => {
    it("fetches funding with optional time range", async () => {
      const mockFunding: Awaited<ReturnType<InfoClient["userFunding"]>> = [];
      const layer = makeTestLayer({
        userFunding: () => Promise.resolve(mockFunding),
      });

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* UserDataService;
          return yield* svc.getUserFunding(WALLET, 1000, 2000);
        }).pipe(Effect.provide(layer)),
      );

      expect(result).toEqual(mockFunding);
    });
  });

  describe("wallet address propagation", () => {
    it("passes wallet address to HyperliquidClient info API", async () => {
      const spy = vi.fn<(user: string) => void>();
      const testWallet = "0xINFO_WALLET";

      const info = {
        clearinghouseState: vi
          .fn<InfoClient["clearinghouseState"]>()
          .mockImplementation((params) => {
            spy(params.user);
            return Promise.resolve(mockClearinghouseState);
          }),
        openOrders: vi.fn<InfoClient["openOrders"]>(),
        historicalOrders: vi.fn<InfoClient["historicalOrders"]>(),
        userFills: vi.fn<InfoClient["userFills"]>(),
        frontendOpenOrders: vi.fn<InfoClient["frontendOpenOrders"]>(),
        spotClearinghouseState: vi.fn<InfoClient["spotClearinghouseState"]>(),
        meta: vi.fn<InfoClient["meta"]>().mockResolvedValue(mockMeta),
        portfolio: vi.fn<InfoClient["portfolio"]>(),
        userVaultEquities: vi.fn<InfoClient["userVaultEquities"]>(),
        userFunding: vi.fn<InfoClient["userFunding"]>(),
      };

      const customClient = HyperliquidClient.of({
        info: Object.assign(new InfoClient({ transport: new HttpTransport() }), info),
      });

      const testLayer = userDataServiceLayer.pipe(
        Layer.provideMerge(Layer.succeed(HyperliquidClient, customClient)),
      );

      await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* UserDataService;
          return yield* svc.getClearinghouseState(testWallet);
        }).pipe(Effect.provide(testLayer)),
      );

      expect(spy).toHaveBeenCalledWith(testWallet);
    });
  });
});
