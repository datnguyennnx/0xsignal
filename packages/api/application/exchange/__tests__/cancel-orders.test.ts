import { describe, expect, it, beforeEach } from "vitest";
import { Effect } from "effect";
import {
  mockInfoInstance,
  makeTestLayer,
  USER_A,
  ExchangeService,
  HyperliquidInternalError,
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
    vi.clearAllMocks();
  });

  describe("cancelOrders", () => {
    it("cancels a single order by symbol and orderId", async () => {
      mockInfoInstance.meta.mockResolvedValueOnce({ universe: [{ name: "BTC" }, { name: "ETH" }] });
      mockExchangeInstance.cancel.mockResolvedValueOnce({ response: "ok" });

      await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* ExchangeService;
          return yield* svc.cancelOrders({ cancels: [{ symbol: "BTC", orderId: 12345 }] }, USER_A);
        }).pipe(Effect.provide(makeTestLayer()))
      );

      expect(mockInfoInstance.meta).toHaveBeenCalled();
      expect(mockExchangeInstance.cancel).toHaveBeenCalledWith(
        {
          cancels: [{ a: 0, o: 12345 }],
        },
        {}
      );
    });

    it("cancels multiple orders across different symbols", async () => {
      mockInfoInstance.meta.mockResolvedValueOnce({
        universe: [{ name: "BTC" }, { name: "ETH" }, { name: "SOL" }],
      });
      mockExchangeInstance.cancel.mockResolvedValueOnce({ response: "ok" });

      await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* ExchangeService;
          return yield* svc.cancelOrders(
            {
              cancels: [
                { symbol: "ETH", orderId: 111 },
                { symbol: "SOL", orderId: 222 },
              ],
            },
            USER_A
          );
        }).pipe(Effect.provide(makeTestLayer()))
      );

      expect(mockExchangeInstance.cancel).toHaveBeenCalledWith(
        {
          cancels: [
            { a: 1, o: 111 },
            { a: 2, o: 222 },
          ],
        },
        {}
      );
    });

    it("fails with HyperliquidInternalError for unknown symbol", async () => {
      mockInfoInstance.meta.mockResolvedValueOnce({ universe: [{ name: "BTC" }] });

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* ExchangeService;
          return yield* svc.cancelOrders({ cancels: [{ symbol: "UNKNOWN", orderId: 1 }] }, USER_A);
        })
          .pipe(Effect.provide(makeTestLayer()))
          .pipe(Effect.flip)
      );

      expect(result).toBeInstanceOf(HyperliquidInternalError);
      expect(result._tag).toBe("HyperliquidInternalError");
    });
  });
});
