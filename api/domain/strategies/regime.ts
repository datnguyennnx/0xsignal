/** Regime Detection - Market regime classification */

import { Effect, Match } from "effect";
import type { CryptoPrice } from "@0xsignal/shared";
import type { MarketRegime } from "../types";
import { computeIndicators } from "../analysis/indicators";

// Regime detection using pattern matching
const classifyRegime = Match.type<{
  volatility: number;
  trend: number;
  change: number;
  rsi: number;
}>().pipe(
  Match.when(
    ({ volatility }) => volatility > 10,
    () => "HIGH_VOLATILITY" as MarketRegime
  ),
  Match.when(
    ({ volatility }) => volatility < 2,
    () => "LOW_VOLATILITY" as MarketRegime
  ),
  Match.when(
    ({ trend, change }) => trend > 40 && change > 5,
    () => "BULL_MARKET" as MarketRegime
  ),
  Match.when(
    ({ trend, change }) => trend > 40 && change < -5,
    () => "BEAR_MARKET" as MarketRegime
  ),
  Match.when(
    ({ trend }) => trend > 40,
    () => "TRENDING" as MarketRegime
  ),
  Match.when(
    ({ trend }) => trend < 20,
    () => "SIDEWAYS" as MarketRegime
  ),
  Match.when(
    ({ rsi, change }) => rsi > 40 && rsi < 60 && Math.abs(change) < 3,
    () => "MEAN_REVERSION" as MarketRegime
  ),
  Match.orElse(() => "TRENDING" as MarketRegime)
);

export const detectRegime = (price: CryptoPrice): Effect.Effect<MarketRegime, never> =>
  Effect.gen(function* () {
    const indicators = yield* computeIndicators(price);
    return classifyRegime({
      volatility: indicators.atr.normalizedATR,
      trend: indicators.adx.adx,
      change: price.change24h,
      rsi: indicators.rsi.rsi,
    });
  });
