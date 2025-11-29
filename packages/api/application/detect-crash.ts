/** Crash Detection - Detect market crash conditions */

import { Effect, Match } from "effect";
import type { CryptoPrice } from "@0xsignal/shared";
import type { CrashSignal } from "../domain/types";
import { computeIndicators } from "../domain/analysis/indicators";
import { detectCrashIndicators, generateCrashRecommendation } from "../domain/analysis/signals";

// Severity based on active indicator count
const countToSeverity = Match.type<number>().pipe(
  Match.when(
    (n) => n >= 4,
    () => "EXTREME" as const
  ),
  Match.when(
    (n) => n >= 3,
    () => "HIGH" as const
  ),
  Match.when(
    (n) => n >= 2,
    () => "MEDIUM" as const
  ),
  Match.orElse(() => "LOW" as const)
);

export const detectCrash = (price: CryptoPrice): Effect.Effect<CrashSignal, never> =>
  Effect.gen(function* () {
    const indicators = yield* computeIndicators(price);
    const crashIndicators = detectCrashIndicators(price, indicators);

    const activeCount = Object.values(crashIndicators).filter(Boolean).length;
    const isCrashing = activeCount >= 2;
    const severity = countToSeverity(activeCount);
    const confidence = Math.round((activeCount / 4) * 100);

    return {
      isCrashing,
      severity,
      confidence,
      indicators: crashIndicators,
      recommendation: generateCrashRecommendation(
        isCrashing,
        severity,
        price.change24h,
        indicators.rsi.rsi
      ),
    };
  });
