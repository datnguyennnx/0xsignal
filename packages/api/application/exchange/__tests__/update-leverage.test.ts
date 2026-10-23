import { describe, expect, it, beforeEach, vi } from "vitest";
import { Effect } from "effect";
import type {
  ExchangeClient,
  ExchangeConfig,
  HttpTransport,
  HttpTransportOptions,
} from "@nktkas/hyperliquid";
import {
  mockInfoInstance,
  makeTestLayer,
  makeMetaResponse,
  USER_A,
  ExchangeService,
} from "./helpers";

const mockExchangeInstance = vi.hoisted(() => ({
  order: vi.fn<ExchangeClient["order"]>(),
  updateLeverage: vi.fn<ExchangeClient["updateLeverage"]>(),
  cancel: vi.fn<ExchangeClient["cancel"]>(),
}));

vi.mock("@nktkas/hyperliquid", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@nktkas/hyperliquid")>();
  return {
    ...actual,
    ExchangeClient: vi.fn<(config: ExchangeConfig) => typeof mockExchangeInstance>(function () {
      return mockExchangeInstance;
    }),
    HttpTransport: vi.fn<(options?: HttpTransportOptions) => HttpTransport>(),
  };
});

describe("ExchangeService — order operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("updateLeverageAndMargin", () => {
    it("sends isCross and leverage for cross margin mode", async () => {
      mockInfoInstance.meta.mockResolvedValueOnce(makeMetaResponse(["BTC", "ETH"]));
      mockExchangeInstance.updateLeverage.mockResolvedValueOnce({ response: "ok" });

      await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* ExchangeService;
          return yield* svc.updateLeverageAndMargin(
            { symbol: "ETH", isCross: true, leverage: 10 },
            USER_A,
          );
        }).pipe(Effect.provide(makeTestLayer())),
      );

      expect(mockExchangeInstance.updateLeverage).toHaveBeenCalledWith(
        {
          asset: 1,
          isCross: true,
          leverage: 10,
        },
        {},
      );
    });

    it("sends isCross and leverage for isolated margin mode", async () => {
      mockInfoInstance.meta.mockResolvedValueOnce(makeMetaResponse(["BTC", "ETH", "SOL"]));
      mockExchangeInstance.updateLeverage.mockResolvedValueOnce({ response: "ok" });

      await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* ExchangeService;
          return yield* svc.updateLeverageAndMargin(
            { symbol: "SOL", isCross: false, leverage: 5 },
            USER_A,
          );
        }).pipe(Effect.provide(makeTestLayer())),
      );

      expect(mockExchangeInstance.updateLeverage).toHaveBeenCalledWith(
        {
          asset: 2,
          isCross: false,
          leverage: 5,
        },
        {},
      );
    });
  });
});
