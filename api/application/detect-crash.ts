import { Effect } from "effect";
import type { CryptoPrice } from "@0xsignal/shared";
import type { CrashSignal } from "../domain/types";
import { computeIndicators } from "../domain/analysis/indicators";
import { detectCrashIndicators, generateCrashRecommendation } from "../domain/analysis/signals";

export const detectCrash = (price: CryptoPrice): Effect.Effect<CrashSignal, never> =>
  Effect.gen(function* () {
    const indicators = yield* computeIndicators(price);
    const crashIndicators = detectCrashIndicators(price, indicators);

    const activeCount = Object.values(crashIndicators).filter(Boolean).length;
    const isCrashing = activeCount >= 2;

    const severity: CrashSignal["severity"] =
      activeCount === 4
        ? "EXTREME"
        : activeCount === 3
          ? "HIGH"
          : activeCount === 2
            ? "MEDIUM"
            : "LOW";

    const confidence = Math.round((activeCount / 4) * 100);

    const recommendation = generateCrashRecommendation(
      isCrashing,
      severity,
      price.change24h,
      indicators.rsi.rsi
    );

    return {
      isCrashing,
      severity,
      confidence,
      indicators: crashIndicators,
      recommendation,
    };
  });
