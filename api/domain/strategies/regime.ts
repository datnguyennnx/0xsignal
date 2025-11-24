import { Effect } from "effect";
import type { CryptoPrice } from "@0xsignal/shared";
import type { MarketRegime } from "../types";
import { computeIndicators } from "../analysis/indicators";

export const detectRegime = (price: CryptoPrice): Effect.Effect<MarketRegime, never> =>
  Effect.gen(function* () {
    const indicators = yield* computeIndicators(price);

    const volatility = indicators.atr.normalizedATR;
    const trend = indicators.adx.adx;
    const priceChange = price.change24h;

    if (volatility > 10) {
      return "HIGH_VOLATILITY";
    }

    if (volatility < 2) {
      return "LOW_VOLATILITY";
    }

    if (trend > 40) {
      return priceChange > 5 ? "BULL_MARKET" : priceChange < -5 ? "BEAR_MARKET" : "TRENDING";
    }

    if (trend < 20) {
      return "SIDEWAYS";
    }

    const rsi = indicators.rsi.rsi;
    if (rsi > 40 && rsi < 60 && Math.abs(priceChange) < 3) {
      return "MEAN_REVERSION";
    }

    return "TRENDING";
  });
