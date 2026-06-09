import { describe, expect, it, beforeEach } from "vitest";
import { Effect } from "effect";
import { mockInfoInstance, makeTestLayer, USER_A, ExchangeService } from "./helpers";

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

  describe("updateLeverageAndMargin", () => {
    it("sends isCross and leverage for cross margin mode", async () => {
      mockInfoInstance.meta.mockResolvedValueOnce({
        universe: [{ name: "BTC" }, { name: "ETH" }],
      });
      mockExchangeInstance.updateLeverage.mockResolvedValueOnce({ response: "ok" });

      await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* ExchangeService;
          return yield* svc.updateLeverageAndMargin(
            { symbol: "ETH", isCross: true, leverage: 10 },
            USER_A
          );
        }).pipe(Effect.provide(makeTestLayer()))
      );

      expect(mockExchangeInstance.updateLeverage).toHaveBeenCalledWith(
        {
          asset: 1,
          isCross: true,
          leverage: 10,
        },
        {}
      );
    });

    it("sends isCross and leverage for isolated margin mode", async () => {
      mockInfoInstance.meta.mockResolvedValueOnce({
        universe: [{ name: "BTC" }, { name: "ETH" }, { name: "SOL" }],
      });
      mockExchangeInstance.updateLeverage.mockResolvedValueOnce({ response: "ok" });

      await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* ExchangeService;
          return yield* svc.updateLeverageAndMargin(
            { symbol: "SOL", isCross: false, leverage: 5 },
            USER_A
          );
        }).pipe(Effect.provide(makeTestLayer()))
      );

      expect(mockExchangeInstance.updateLeverage).toHaveBeenCalledWith(
        {
          asset: 2,
          isCross: false,
          leverage: 5,
        },
        {}
      );
    });
  });
});
