import { describe, expect, it, beforeEach } from "vitest";
import { Effect } from "effect";
import { ValiError } from "valibot";
import { ApiRequestError } from "@nktkas/hyperliquid/api/exchange";
import {
  mockInfoInstance,
  makeTestLayer,
  USER_A,
  ExchangeService,
  InsufficientMarginError,
  HyperliquidValidationError,
  HyperliquidInternalError,
  AccountNotFound,
} from "./helpers";

const mockExchangeInstance = vi.hoisted(() => ({
  order: vi.fn(),
  updateLeverage: vi.fn(),
  cancel: vi.fn(),
}));

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

describe("ExchangeService — order operations", () => {
  beforeEach(() => {
    // Mocks are shared across test files; clear only call history, not implementations
    vi.clearAllMocks();
  });

  describe("placeOrder", () => {
    it("builds correct HL payload from generic input", async () => {
      mockInfoInstance.meta.mockResolvedValueOnce({ universe: [{ name: "BTC" }] });
      mockExchangeInstance.order.mockResolvedValueOnce({ response: "ok" });

      await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* ExchangeService;
          return yield* svc.placeOrder(
            {
              orders: [
                {
                  symbol: "BTC",
                  side: "buy",
                  price: "100",
                  quantity: "0.5",
                  reduceOnly: false,
                  orderType: { kind: "limit", timeInForce: "GTC" },
                },
              ],
            },
            USER_A,
          );
        }).pipe(Effect.provide(makeTestLayer())),
      );

      const callArg = mockExchangeInstance.order.mock.calls[0][0];
      expect(callArg.orders[0].a).toBe(0);
      expect(callArg.orders[0].b).toBe(true);
      expect(callArg.orders[0].p).toBe("100");
      expect(callArg.orders[0].s).toBe("0.5");
      expect(callArg.orders[0].r).toBe(false);
      expect(callArg.grouping).toBe("na");
    });

    it("maps insufficient margin ApiRequestError to InsufficientMarginError", async () => {
      mockInfoInstance.meta.mockResolvedValueOnce({ universe: [{ name: "BTC" }] });
      const error = new ApiRequestError({
        status: "err",
        response: "insufficient margin for order",
      });
      mockExchangeInstance.order.mockRejectedValueOnce(error);

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* ExchangeService;
          return yield* svc.placeOrder(
            {
              orders: [
                {
                  symbol: "BTC",
                  side: "buy",
                  price: "100",
                  quantity: "0.5",
                  reduceOnly: false,
                  orderType: { kind: "limit", timeInForce: "GTC" },
                },
              ],
            },
            USER_A,
          );
        })
          .pipe(Effect.provide(makeTestLayer()))
          .pipe(Effect.flip),
      );

      expect(result).toBeInstanceOf(InsufficientMarginError);
      expect(result._tag).toBe("InsufficientMarginError");
    });

    it("maps ValiError to HyperliquidValidationError", async () => {
      mockInfoInstance.meta.mockResolvedValueOnce({ universe: [{ name: "BTC" }] });
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
          const svc = yield* ExchangeService;
          return yield* svc.placeOrder(
            {
              orders: [
                {
                  symbol: "BTC",
                  side: "buy",
                  price: "100",
                  quantity: "0.5",
                  reduceOnly: false,
                  orderType: { kind: "limit", timeInForce: "GTC" },
                },
              ],
            },
            USER_A,
          );
        })
          .pipe(Effect.provide(makeTestLayer()))
          .pipe(Effect.flip),
      );

      expect(result).toBeInstanceOf(HyperliquidValidationError);
      expect(result._tag).toBe("HyperliquidValidationError");
    });

    it("sends TP/SL child orders with r:true and opposite b direction", async () => {
      mockInfoInstance.meta.mockResolvedValueOnce({ universe: [{ name: "BTC" }] });
      mockExchangeInstance.order.mockResolvedValueOnce({ response: "ok" });

      await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* ExchangeService;
          return yield* svc.placeOrder(
            {
              orders: [
                {
                  symbol: "BTC",
                  side: "buy",
                  price: "100",
                  quantity: "0.5",
                  reduceOnly: false,
                  orderType: { kind: "limit", timeInForce: "GTC" },
                },
                {
                  symbol: "BTC",
                  side: "sell",
                  price: "110",
                  quantity: "0.5",
                  reduceOnly: true,
                  orderType: { kind: "trigger", isMarket: true, triggerPrice: "110", tpsl: "tp" },
                },
                {
                  symbol: "BTC",
                  side: "sell",
                  price: "90",
                  quantity: "0.5",
                  reduceOnly: true,
                  orderType: { kind: "trigger", isMarket: true, triggerPrice: "90", tpsl: "sl" },
                },
              ],
              grouping: "normalTpsl",
            },
            USER_A,
          );
        }).pipe(Effect.provide(makeTestLayer())),
      );

      const callArg = mockExchangeInstance.order.mock.calls[0][0];
      expect(callArg.orders).toHaveLength(3);
      expect(callArg.orders[0].b).toBe(true);
      expect(callArg.orders[0].r).toBe(false);
      expect(callArg.orders[1].b).toBe(false);
      expect(callArg.orders[1].r).toBe(true);
      expect(callArg.orders[1].t.trigger.tpsl).toBe("tp");
      expect(callArg.orders[2].b).toBe(false);
      expect(callArg.orders[2].r).toBe(true);
      expect(callArg.orders[2].t.trigger.tpsl).toBe("sl");
    });

    it("enforces reduceOnly true for close position orders", async () => {
      mockInfoInstance.meta.mockResolvedValueOnce({ universe: [{ name: "BTC" }] });
      mockExchangeInstance.order.mockResolvedValueOnce({ response: "ok" });

      await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* ExchangeService;
          return yield* svc.placeOrder(
            {
              orders: [
                {
                  symbol: "BTC",
                  side: "sell",
                  price: "0",
                  quantity: "0.5",
                  reduceOnly: true,
                  orderType: { kind: "limit", timeInForce: "FrontendMarket" },
                },
              ],
              grouping: "na",
            },
            USER_A,
          );
        }).pipe(Effect.provide(makeTestLayer())),
      );

      const callArg = mockExchangeInstance.order.mock.calls[0][0];
      expect(callArg.orders[0].r).toBe(true);
    });

    it("fails with AccountNotFound when primary account not found", async () => {
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* ExchangeService;
          return yield* svc.placeOrder({ orders: [] }, USER_A);
        })
          .pipe(
            Effect.provide(
              makeTestLayer({
                findPrimary: vi
                  .fn()
                  .mockReturnValue(
                    Effect.fail(new AccountNotFound({ accountId: "primary@user-a/hyperliquid" })),
                  ),
              }),
            ),
          )
          .pipe(Effect.flip),
      );

      expect(result).toBeInstanceOf(AccountNotFound);
      expect(result._tag).toBe("AccountNotFound");
    });
  });
});
