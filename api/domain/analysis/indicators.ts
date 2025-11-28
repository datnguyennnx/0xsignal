/**
 * Technical Indicators
 * Concurrent computation of all indicators for a price
 */

import { Effect } from "effect";
import type { CryptoPrice } from "@0xsignal/shared";
import { computeRSI } from "../formulas/momentum/rsi";
import { computeMACDFromPrice } from "../formulas/momentum/macd";
import { computeADX } from "../formulas/trend/adx";
import { computeATR } from "../formulas/volatility/atr";
import { computeVolumeROC } from "../formulas/volume/volume-roc";
import { computeMaximumDrawdown } from "../formulas/risk/maximum-drawdown";
import { detectDivergence } from "../formulas/momentum/rsi";

// Indicator set type
export interface IndicatorSet {
  readonly rsi: Effect.Effect.Success<ReturnType<typeof computeRSI>>;
  readonly macd: Effect.Effect.Success<ReturnType<typeof computeMACDFromPrice>>;
  readonly adx: Effect.Effect.Success<ReturnType<typeof computeADX>>;
  readonly atr: Effect.Effect.Success<ReturnType<typeof computeATR>>;
  readonly volumeROC: Effect.Effect.Success<ReturnType<typeof computeVolumeROC>>;
  readonly drawdown: Effect.Effect.Success<ReturnType<typeof computeMaximumDrawdown>>;
  readonly divergence: Effect.Effect.Success<ReturnType<typeof detectDivergence>>;
}

// Prepare price arrays from single price point
const preparePriceArrays = (price: CryptoPrice) => {
  const closes =
    price.high24h && price.low24h ? [price.low24h, price.price, price.high24h] : [price.price];
  const highs = price.high24h ? [price.high24h, price.high24h, price.high24h] : [price.price];
  const lows = price.low24h ? [price.low24h, price.low24h, price.low24h] : [price.price];
  const volumes = price.volume24h ? [price.volume24h, price.volume24h] : [price.volume24h];

  return { closes, highs, lows, volumes };
};

// Compute all indicators concurrently using struct syntax
export const computeIndicators = (price: CryptoPrice): Effect.Effect<IndicatorSet, never> =>
  Effect.gen(function* () {
    const { closes, highs, lows, volumes } = preparePriceArrays(price);

    // Use struct-based Effect.all for named results
    const indicators = yield* Effect.all(
      {
        rsi: computeRSI(price),
        macd: computeMACDFromPrice(price),
        adx: computeADX(highs, lows, closes),
        atr: computeATR(highs, lows, closes),
        volumeROC: computeVolumeROC(volumes),
        drawdown: computeMaximumDrawdown(closes),
        divergence: detectDivergence(price),
      },
      { concurrency: "unbounded" }
    );

    return indicators;
  });

// Compute subset of indicators for quick analysis
export const computeQuickIndicators = (price: CryptoPrice) =>
  Effect.gen(function* () {
    const { closes, highs, lows } = preparePriceArrays(price);

    return yield* Effect.all(
      {
        rsi: computeRSI(price),
        atr: computeATR(highs, lows, closes),
        adx: computeADX(highs, lows, closes),
      },
      { concurrency: "unbounded" }
    );
  });
