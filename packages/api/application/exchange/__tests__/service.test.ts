/* ─── Hoisted mocks (shared between mock factory and test bodies) ─── */

const mockExchangeInstance = vi.hoisted(() => ({
  order: vi.fn(),
  updateLeverage: vi.fn(),
  cancel: vi.fn(),
}));

/* ─── Module mocks ─── */

vi.mock("@nktkas/hyperliquid", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@nktkas/hyperliquid")>();
  return {
    ...actual,
    ExchangeClient: vi.fn(function () {
      return mockExchangeInstance;
    }),
    HttpTransport: vi.fn(),
  };
});

vi.mock("@nktkas/hyperliquid/api/exchange", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@nktkas/hyperliquid/api/exchange")>();
  return { ...actual };
});

/* ─── Imports ─── */

import { describe, expect, it, vi, beforeAll, beforeEach } from "vitest";
import { Effect, Layer } from "effect";
import { ValiError } from "valibot";
import type { InfoClient } from "@nktkas/hyperliquid";
import { ApiRequestError } from "@nktkas/hyperliquid/api/exchange";
import { HyperliquidClient } from "../../../infrastructure/data-sources/hyperliquid/client";
import { ExchangeServices } from "../contracts";
import { ExchangeServicesLive } from "../service";
import {
  HyperliquidValidationError,
  InsufficientMarginError,
  HyperliquidInternalError,
} from "../../../domain/errors";

/* ─── Fixtures ─── */

const VALID_PRIVATE_KEY = "0x" + "a".repeat(64);

/* ─── Mock HyperliquidClient (info only) ─── */

const mockInfoInstance = {
  meta: vi.fn(),
};

const makeMockHLClient = () =>
  Layer.succeed(
    HyperliquidClient,
    HyperliquidClient.of({
      info: mockInfoInstance as unknown as InfoClient,
    })
  );

const makeTestLayer = () => ExchangeServicesLive.pipe(Layer.provideMerge(makeMockHLClient()));

/* ─── Tests ─── */

describe("ExchangeServices", () => {
  beforeAll(() => {
    process.env.HYPERLIQUID_PRIVATE_KEY = VALID_PRIVATE_KEY;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("placeOrder", () => {
    it("coerces payload types before calling SDK", async () => {
      mockExchangeInstance.order.mockResolvedValueOnce({ response: "ok" });

      await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* ExchangeServices;
          return yield* svc.placeOrder({
            orders: [
              {
                a: "1" as unknown as number,
                b: 1 as unknown as boolean,
                p: 100 as unknown as string,
                s: 0.5 as unknown as string,
                r: 0 as unknown as boolean,
                t: { limit: { tif: "Gtc" as const } },
              },
            ],
          });
        }).pipe(Effect.provide(makeTestLayer()))
      );

      const callArg = mockExchangeInstance.order.mock.calls[0][0];
      expect(callArg.orders[0].a).toBe(1);
      expect(callArg.orders[0].b).toBe(true);
      expect(callArg.orders[0].p).toBe("100");
      expect(callArg.orders[0].s).toBe("0.5");
      expect(callArg.orders[0].r).toBe(false);
      expect(callArg.grouping).toBe("na");
    });

    it("maps insufficient margin ApiRequestError to InsufficientMarginError", async () => {
      // ApiRequestError constructor takes a raw API response object.
      // { status: "err", response: "..." } matches the hasErrorStatus duck-type check
      // and extractErrorMessage returns response.response as the message.
      const error = new ApiRequestError({
        status: "err",
        response: "insufficient margin for order",
      });
      mockExchangeInstance.order.mockRejectedValueOnce(error);

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* ExchangeServices;
          return yield* svc.placeOrder({
            orders: [
              {
                a: 1,
                b: true,
                p: "100",
                s: "0.5",
                r: false,
                t: { limit: { tif: "Gtc" as const } },
              },
            ],
          });
        })
          .pipe(Effect.provide(makeTestLayer()))
          .pipe(Effect.flip)
      );

      expect(result).toBeInstanceOf(InsufficientMarginError);
      expect(result._tag).toBe("InsufficientMarginError");
    });

    it("maps ValiError to HyperliquidValidationError", async () => {
      const error = new ValiError([
        {
          kind: "schema",
          type: "string",
          input: {},
          expected: "",
          received: "",
          message: "Invalid payload",
        } as any,
      ]);
      mockExchangeInstance.order.mockRejectedValueOnce(error);

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* ExchangeServices;
          return yield* svc.placeOrder({
            orders: [
              {
                a: 1,
                b: true,
                p: "100",
                s: "0.5",
                r: false,
                t: { limit: { tif: "Gtc" as const } },
              },
            ],
          });
        })
          .pipe(Effect.provide(makeTestLayer()))
          .pipe(Effect.flip)
      );

      expect(result).toBeInstanceOf(HyperliquidValidationError);
      expect(result._tag).toBe("HyperliquidValidationError");
    });

    it("sends TP/SL child orders with r:true and opposite b direction", async () => {
      mockExchangeInstance.order.mockResolvedValueOnce({ response: "ok" });

      await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* ExchangeServices;
          return yield* svc.placeOrder({
            orders: [
              {
                a: 1,
                b: true,
                p: "100",
                s: "0.5",
                r: false,
                t: { limit: { tif: "Gtc" as const } },
              },
              {
                a: 1,
                b: false,
                p: "110",
                s: "0.5",
                r: true,
                t: { trigger: { isMarket: true, triggerPx: "110", tpsl: "tp" as const } },
              },
              {
                a: 1,
                b: false,
                p: "90",
                s: "0.5",
                r: true,
                t: { trigger: { isMarket: true, triggerPx: "90", tpsl: "sl" as const } },
              },
            ],
            grouping: "normalTpsl",
          });
        }).pipe(Effect.provide(makeTestLayer()))
      );

      const callArg = mockExchangeInstance.order.mock.calls[0][0];
      expect(callArg.orders).toHaveLength(3);
      // Parent
      expect(callArg.orders[0].b).toBe(true);
      expect(callArg.orders[0].r).toBe(false);
      // TP child
      expect(callArg.orders[1].b).toBe(false);
      expect(callArg.orders[1].r).toBe(true);
      expect(callArg.orders[1].t.trigger.tpsl).toBe("tp");
      // SL child
      expect(callArg.orders[2].b).toBe(false);
      expect(callArg.orders[2].r).toBe(true);
      expect(callArg.orders[2].t.trigger.tpsl).toBe("sl");
    });

    it("enforces reduceOnly true for close position orders", async () => {
      mockExchangeInstance.order.mockResolvedValueOnce({ response: "ok" });

      await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* ExchangeServices;
          return yield* svc.placeOrder({
            orders: [
              {
                a: 1,
                b: false,
                p: "0",
                s: "0.5",
                r: true,
                t: { limit: { tif: "FrontendMarket" as const } },
              },
            ],
            grouping: "na",
          });
        }).pipe(Effect.provide(makeTestLayer()))
      );

      const callArg = mockExchangeInstance.order.mock.calls[0][0];
      expect(callArg.orders[0].r).toBe(true);
    });
  });

  describe("updateLeverageAndMargin", () => {
    it("sends isCross and leverage for cross margin mode", async () => {
      mockExchangeInstance.updateLeverage.mockResolvedValueOnce({ response: "ok" });

      await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* ExchangeServices;
          return yield* svc.updateLeverageAndMargin({ asset: 1, isCross: true, leverage: 10 });
        }).pipe(Effect.provide(makeTestLayer()))
      );

      expect(mockExchangeInstance.updateLeverage).toHaveBeenCalledWith({
        asset: 1,
        isCross: true,
        leverage: 10,
      });
    });

    it("sends isCross and leverage for isolated margin mode", async () => {
      mockExchangeInstance.updateLeverage.mockResolvedValueOnce({ response: "ok" });

      await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* ExchangeServices;
          return yield* svc.updateLeverageAndMargin({ asset: 2, isCross: false, leverage: 5 });
        }).pipe(Effect.provide(makeTestLayer()))
      );

      expect(mockExchangeInstance.updateLeverage).toHaveBeenCalledWith({
        asset: 2,
        isCross: false,
        leverage: 5,
      });
    });
  });

  describe("cancelOrders", () => {
    it("cancels a single order by coin and oid", async () => {
      mockInfoInstance.meta.mockResolvedValueOnce({ universe: [{ name: "BTC" }, { name: "ETH" }] });
      mockExchangeInstance.cancel.mockResolvedValueOnce({ response: "ok" });

      await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* ExchangeServices;
          return yield* svc.cancelOrders({ cancels: [{ coin: "BTC", o: 12345 }] });
        }).pipe(Effect.provide(makeTestLayer()))
      );

      expect(mockInfoInstance.meta).toHaveBeenCalled();
      expect(mockExchangeInstance.cancel).toHaveBeenCalledWith({
        cancels: [{ a: 0, o: 12345 }],
      });
    });

    it("cancels multiple orders across different coins", async () => {
      mockInfoInstance.meta.mockResolvedValueOnce({
        universe: [{ name: "BTC" }, { name: "ETH" }, { name: "SOL" }],
      });
      mockExchangeInstance.cancel.mockResolvedValueOnce({ response: "ok" });

      await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* ExchangeServices;
          return yield* svc.cancelOrders({
            cancels: [
              { coin: "ETH", o: 111 },
              { coin: "SOL", o: 222 },
            ],
          });
        }).pipe(Effect.provide(makeTestLayer()))
      );

      expect(mockExchangeInstance.cancel).toHaveBeenCalledWith({
        cancels: [
          { a: 1, o: 111 },
          { a: 2, o: 222 },
        ],
      });
    });

    it("fails with HyperliquidInternalError for unknown coin", async () => {
      mockInfoInstance.meta.mockResolvedValueOnce({ universe: [{ name: "BTC" }] });

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* ExchangeServices;
          return yield* svc.cancelOrders({ cancels: [{ coin: "UNKNOWN", o: 1 }] });
        })
          .pipe(Effect.provide(makeTestLayer()))
          .pipe(Effect.flip)
      );

      expect(result).toBeInstanceOf(HyperliquidInternalError);
      expect(result._tag).toBe("HyperliquidInternalError");
    });
  });

  describe("error handling", () => {
    it("returns HyperliquidInternalError when private key is not configured", async () => {
      const originalKey = process.env.HYPERLIQUID_PRIVATE_KEY;
      process.env.HYPERLIQUID_PRIVATE_KEY = "";

      const NoKeyTestLayer = ExchangeServicesLive.pipe(Layer.provideMerge(makeMockHLClient()));

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* ExchangeServices;
          return yield* svc.placeOrder({ orders: [] });
        })
          .pipe(Effect.provide(NoKeyTestLayer))
          .pipe(Effect.flip)
      );

      expect(result).toBeInstanceOf(HyperliquidInternalError);
      expect(result._tag).toBe("HyperliquidInternalError");
      expect(result.message).toContain("HYPERLIQUID_PRIVATE_KEY");

      process.env.HYPERLIQUID_PRIVATE_KEY = originalKey;
    });
  });
});
