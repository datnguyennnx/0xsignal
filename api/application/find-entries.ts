/** Entry Detection - Find optimal entry points */

import { Effect, Match } from "effect";
import type { CryptoPrice } from "@0xsignal/shared";
import type { EntrySignal } from "../domain/types";
import { computeIndicators } from "../domain/analysis/indicators";
import {
  detectEntryIndicators,
  generateEntryRecommendation,
  calculateEntryLevels,
} from "../domain/analysis/signals";

// Strength based on active indicator count
const countToStrength = Match.type<number>().pipe(
  Match.when(
    (n) => n >= 4,
    () => "VERY_STRONG" as const
  ),
  Match.when(
    (n) => n >= 3,
    () => "STRONG" as const
  ),
  Match.when(
    (n) => n >= 2,
    () => "MODERATE" as const
  ),
  Match.orElse(() => "WEAK" as const)
);

export const findEntry = (price: CryptoPrice): Effect.Effect<EntrySignal, never> =>
  Effect.gen(function* () {
    const indicators = yield* computeIndicators(price);
    const entryIndicators = detectEntryIndicators(price, indicators);

    const activeCount = Object.values(entryIndicators).filter(Boolean).length;
    const isOptimalEntry = activeCount >= 2;
    const strength = countToStrength(activeCount);
    const confidence = Math.round((activeCount / 4) * 70 + (indicators.adx.adx / 100) * 30);
    const { target, stopLoss } = calculateEntryLevels(price.price, strength);

    return {
      isOptimalEntry,
      strength,
      confidence,
      indicators: entryIndicators,
      entryPrice: price.price,
      targetPrice: target,
      stopLoss,
      recommendation: generateEntryRecommendation(
        isOptimalEntry,
        strength,
        price.price,
        target,
        stopLoss
      ),
    };
  });
