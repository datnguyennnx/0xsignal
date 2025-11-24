import { Effect } from "effect";
import type { CryptoPrice } from "@0xsignal/shared";
import type { EntrySignal } from "../domain/types";
import { computeIndicators } from "../domain/analysis/indicators";
import {
  detectEntryIndicators,
  generateEntryRecommendation,
  calculateEntryLevels,
} from "../domain/analysis/signals";

export const findEntry = (price: CryptoPrice): Effect.Effect<EntrySignal, never> =>
  Effect.gen(function* () {
    const indicators = yield* computeIndicators(price);
    const entryIndicators = detectEntryIndicators(price, indicators);

    const activeCount = Object.values(entryIndicators).filter(Boolean).length;
    const isOptimalEntry = activeCount >= 2;

    const strength: EntrySignal["strength"] =
      activeCount === 4
        ? "VERY_STRONG"
        : activeCount === 3
          ? "STRONG"
          : activeCount === 2
            ? "MODERATE"
            : "WEAK";

    const confidence = Math.round((activeCount / 4) * 70 + (indicators.adx.adx / 100) * 30);

    const entryPrice = price.price;
    const { target, stopLoss } = calculateEntryLevels(price.price, strength);

    const recommendation = generateEntryRecommendation(
      isOptimalEntry,
      strength,
      entryPrice,
      target,
      stopLoss
    );

    return {
      isOptimalEntry,
      strength,
      confidence,
      indicators: entryIndicators,
      entryPrice,
      targetPrice: target,
      stopLoss,
      recommendation,
    };
  });
