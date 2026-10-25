import { Effect } from "effect";
import type { OrderSide, OrderType } from "@0xsignal/shared";
import { HyperliquidValidationError } from "../../shared/errors";
import { type HlTif, toHlTif } from "./error-classification";

export { buildCoinToAsset } from "./asset-index";

const MARKET_TIME_IN_FORCE: ReadonlySet<string> = new Set(["FrontendMarket", "Market"]);

type HyperliquidOrderType =
  | { readonly limit: { readonly tif: HlTif } }
  | {
      readonly trigger: {
        readonly isMarket: boolean;
        readonly triggerPx: string;
        readonly tpsl: "tp" | "sl";
      };
    };

export type OrderValidationInput = {
  readonly symbol: string;
  readonly side: OrderSide;
  readonly quantity: string;
  readonly price: string;
  readonly reduceOnly: boolean;
  readonly orderType: OrderType;
};

export type ValidatedOrder = {
  readonly assetIndex: number;
  readonly isBuy: boolean;
  readonly price: string;
  readonly size: string;
  readonly reduceOnly: boolean;
  readonly hyperliquidType: HyperliquidOrderType;
};

// The single place an order is judged admissible. `placeOrder` and the intent
// route both call it, so their rejections can never drift.
export const validateOrderInput = (
  input: OrderValidationInput,
  coinToAsset: ReadonlyMap<string, number>,
): Effect.Effect<ValidatedOrder, HyperliquidValidationError> =>
  Effect.gen(function* () {
    const zeroPrice = Number(input.price) === 0;
    const marketClose =
      input.reduceOnly &&
      input.orderType.kind === "limit" &&
      MARKET_TIME_IN_FORCE.has(input.orderType.timeInForce);
    if (zeroPrice && !marketClose) {
      return yield* Effect.fail(
        new HyperliquidValidationError({
          message: "price must be > 0 unless closing with a market order",
          symbol: input.symbol,
          input: { price: input.price, reduceOnly: input.reduceOnly },
        }),
      );
    }

    const assetIndex = coinToAsset.get(input.symbol);
    if (assetIndex === undefined) {
      return yield* Effect.fail(
        new HyperliquidValidationError({
          message: `Symbol not supported on Hyperliquid: ${input.symbol}`,
          symbol: input.symbol,
        }),
      );
    }

    const hyperliquidType: HyperliquidOrderType =
      input.orderType.kind === "limit"
        ? { limit: { tif: yield* toHlTif(input.orderType.timeInForce) } }
        : {
            trigger: {
              isMarket: input.orderType.isMarket,
              triggerPx: input.orderType.triggerPrice,
              tpsl: input.orderType.tpsl,
            },
          };

    return {
      assetIndex,
      isBuy: input.side === "buy",
      price: input.price,
      size: input.quantity,
      reduceOnly: input.reduceOnly,
      hyperliquidType,
    };
  });
