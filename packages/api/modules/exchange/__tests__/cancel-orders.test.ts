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
  CANCEL_OK,
  USER_A,
  ExchangeService,
  HyperliquidValidationError,
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

  describe("cancelOrders", () => {
    it("cancels a single order by symbol and orderId", async () => {
      mockInfoInstance.meta.mockResolvedValueOnce(makeMetaResponse(["BTC", "ETH"]));
      mockExchangeInstance.cancel.mockResolvedValueOnce(CANCEL_OK);

      await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* ExchangeService;
          return yield* svc.cancelOrders({ cancels: [{ symbol: "BTC", orderId: 12345 }] }, USER_A);
        }).pipe(Effect.provide(makeTestLayer())),
      );

      expect(mockInfoInstance.meta).toHaveBeenCalled();
      expect(mockExchangeInstance.cancel).toHaveBeenCalledWith(
        {
          cancels: [{ a: 0, o: 12345 }],
        },
        {},
      );
    });

    it("cancels multiple orders across different symbols", async () => {
      mockInfoInstance.meta.mockResolvedValueOnce(makeMetaResponse(["BTC", "ETH", "SOL"]));
      mockExchangeInstance.cancel.mockResolvedValueOnce(CANCEL_OK);

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
            USER_A,
          );
        }).pipe(Effect.provide(makeTestLayer())),
      );

      expect(mockExchangeInstance.cancel).toHaveBeenCalledWith(
        {
          cancels: [
            { a: 1, o: 111 },
            { a: 2, o: 222 },
          ],
        },
        {},
      );
    });

    it("fails with HyperliquidValidationError for unknown symbol", async () => {
      mockInfoInstance.meta.mockResolvedValueOnce(makeMetaResponse(["BTC"]));

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* ExchangeService;
          return yield* svc.cancelOrders({ cancels: [{ symbol: "UNKNOWN", orderId: 1 }] }, USER_A);
        })
          .pipe(Effect.provide(makeTestLayer()))
          .pipe(Effect.flip),
      );

      expect(result).toBeInstanceOf(HyperliquidValidationError);
      expect(result).toHaveProperty("_tag", "HyperliquidValidationError");
    });
  });
});
