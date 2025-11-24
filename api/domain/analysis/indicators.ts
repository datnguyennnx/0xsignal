import { Effect } from "effect";
import type { CryptoPrice } from "@0xsignal/shared";
import { computeRSI } from "../formulas/momentum/rsi";
import { computeMACDFromPrice } from "../formulas/momentum/macd";
import { computeADX } from "../formulas/trend/adx";
import { computeATR } from "../formulas/volatility/atr";
import { computeVolumeROC } from "../formulas/volume/volume-roc";
import { computeMaximumDrawdown } from "../formulas/risk/maximum-drawdown";
import { detectDivergence } from "../formulas/momentum/rsi";

export interface IndicatorSet {
  readonly rsi: Effect.Effect.Success<ReturnType<typeof computeRSI>>;
  readonly macd: Effect.Effect.Success<ReturnType<typeof computeMACDFromPrice>>;
  readonly adx: Effect.Effect.Success<ReturnType<typeof computeADX>>;
  readonly atr: Effect.Effect.Success<ReturnType<typeof computeATR>>;
  readonly volumeROC: Effect.Effect.Success<ReturnType<typeof computeVolumeROC>>;
  readonly drawdown: Effect.Effect.Success<ReturnType<typeof computeMaximumDrawdown>>;
  readonly divergence: Effect.Effect.Success<ReturnType<typeof detectDivergence>>;
}

const preparePriceArrays = (price: CryptoPrice) => {
  const closes =
    price.high24h && price.low24h ? [price.low24h, price.price, price.high24h] : [price.price];
  const highs = price.high24h ? [price.high24h, price.high24h, price.high24h] : [price.price];
  const lows = price.low24h ? [price.low24h, price.low24h, price.low24h] : [price.price];
  const volumes = price.volume24h ? [price.volume24h, price.volume24h] : [price.volume24h];

  return { closes, highs, lows, volumes };
};

export const computeIndicators = (price: CryptoPrice): Effect.Effect<IndicatorSet, never> =>
  Effect.gen(function* () {
    const { closes, highs, lows, volumes } = preparePriceArrays(price);

    const [rsi, macd, adx, atr, volumeROC, drawdown, divergence] = yield* Effect.all(
      [
        computeRSI(price),
        computeMACDFromPrice(price),
        computeADX(highs, lows, closes),
        computeATR(highs, lows, closes),
        computeVolumeROC(volumes),
        computeMaximumDrawdown(closes),
        detectDivergence(price),
      ],
      { concurrency: "unbounded" }
    );

    return {
      rsi,
      macd,
      adx,
      atr,
      volumeROC,
      drawdown,
      divergence,
    };
  });
