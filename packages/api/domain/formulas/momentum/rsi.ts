/** RSI - Real calculation using historical close prices */

import { Effect, Match, pipe } from "effect";

export interface RSIHistoricalResult {
  readonly rsi: number;
  readonly signal: "OVERSOLD" | "NEUTRAL" | "OVERBOUGHT";
  readonly momentum: number;
  readonly avgGain: number;
  readonly avgLoss: number;
}

const DEFAULT_PERIOD = 14;

const classifySignal = Match.type<number>().pipe(
  Match.when(
    (r) => r > 70,
    () => "OVERBOUGHT" as const
  ),
  Match.when(
    (r) => r < 30,
    () => "OVERSOLD" as const
  ),
  Match.orElse(() => "NEUTRAL" as const)
);

const calculateChanges = (closes: readonly number[]): readonly number[] => {
  const changes: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i] - closes[i - 1]);
  }
  return changes;
};

const calculateRSI = (closes: readonly number[], period: number): RSIHistoricalResult => {
  if (closes.length < period + 1) {
    return {
      rsi: 50,
      signal: "NEUTRAL",
      momentum: 0,
      avgGain: 0,
      avgLoss: 0,
    };
  }

  const changes = calculateChanges(closes);

  let gainSum = 0;
  let lossSum = 0;

  for (let i = 0; i < period; i++) {
    const change = changes[i];
    if (change > 0) gainSum += change;
    else lossSum += Math.abs(change);
  }

  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;

  for (let i = period; i < changes.length; i++) {
    const change = changes[i];
    if (change > 0) {
      avgGain = (avgGain * (period - 1) + change) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period;
    }
  }

  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const rsi = 100 - 100 / (1 + rs);
  const clampedRsi = Math.max(0, Math.min(100, rsi));

  return {
    rsi: Math.round(clampedRsi * 10) / 10,
    signal: classifySignal(clampedRsi),
    momentum: (clampedRsi - 50) / 50,
    avgGain,
    avgLoss,
  };
};

export const computeRSIFromHistory = (
  closes: readonly number[],
  period: number = DEFAULT_PERIOD
): Effect.Effect<RSIHistoricalResult> => Effect.sync(() => calculateRSI(closes, period));
