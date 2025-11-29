/** RSI (Relative Strength Index) - Momentum Analysis */
// RSI = 100 - (100 / (1 + RS)), RS = Avg Gain / Avg Loss

import { Effect, Match, Option, pipe } from "effect";
import type { CryptoPrice } from "@0xsignal/shared";

export interface RSIResult {
  readonly rsi: number;
  readonly signal: "OVERSOLD" | "NEUTRAL" | "OVERBOUGHT";
  readonly momentum: number;
}

// RSI signal classification
const rsiToSignal = Match.type<number>().pipe(
  Match.when(
    (r) => r > 65,
    () => "OVERBOUGHT" as const
  ),
  Match.when(
    (r) => r < 35,
    () => "OVERSOLD" as const
  ),
  Match.orElse(() => "NEUTRAL" as const)
);

// Clamp value to range
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

// Calculate ATH/ATL adjusted RSI
const adjustForAthAtl = (
  baseRsi: number,
  currentPrice: number,
  ath: number | undefined,
  atl: number | undefined
): number =>
  pipe(
    Option.all({ ath: Option.fromNullable(ath), atl: Option.fromNullable(atl) }),
    Option.filter(({ ath, atl }) => ath > atl),
    Option.map(({ ath, atl }) => {
      const athAtlFactor = (currentPrice - atl) / (ath - atl);
      const athAtlRsi = athAtlFactor * 100;
      return baseRsi * 0.8 + athAtlRsi * 0.2;
    }),
    Option.getOrElse(() => baseRsi)
  );

// Calculate RSI approximation from 24h price data
export const calculateRSI = (
  currentPrice: number,
  change24h: number,
  ath: number | undefined,
  atl: number | undefined
): RSIResult => {
  const baseRsi = 50 + change24h * 3;
  const adjustedRsi = adjustForAthAtl(baseRsi, currentPrice, ath, atl);
  const rsi = clamp(adjustedRsi, 10, 90);

  return {
    rsi: Math.round(rsi * 10) / 10,
    signal: rsiToSignal(rsi),
    momentum: (rsi - 50) / 50,
  };
};

// Effect-based wrapper
export const computeRSI = (price: CryptoPrice): Effect.Effect<RSIResult> =>
  Effect.sync(() => calculateRSI(price.price, price.change24h, price.ath, price.atl));

// RSI Divergence types
export interface RSIDivergenceSignal {
  readonly symbol: string;
  readonly hasDivergence: boolean;
  readonly divergenceType: "BULLISH" | "BEARISH" | "NONE";
  readonly strength: number;
  readonly rsi: number;
  readonly priceAction: "HIGHER_HIGH" | "LOWER_LOW" | "NEUTRAL";
}

// Price action classification
const classifyPriceAction = Match.type<{ priceToATH: number; priceToATL: number }>().pipe(
  Match.when(
    ({ priceToATH }) => priceToATH > 0.9,
    () => "HIGHER_HIGH" as const
  ),
  Match.when(
    ({ priceToATL }) => priceToATL < 1.5,
    () => "LOWER_LOW" as const
  ),
  Match.orElse(() => "NEUTRAL" as const)
);

// Divergence detection based on price action and RSI
const detectDivergenceFromAction = (
  priceAction: "HIGHER_HIGH" | "LOWER_LOW" | "NEUTRAL",
  rsiValue: number
): { hasDivergence: boolean; divergenceType: "BULLISH" | "BEARISH" | "NONE"; strength: number } =>
  pipe(
    Match.value({ priceAction, rsiValue }),
    Match.when(
      ({ priceAction, rsiValue }) => priceAction === "HIGHER_HIGH" && rsiValue < 70,
      ({ rsiValue }) => ({
        hasDivergence: true,
        divergenceType: "BEARISH" as const,
        strength: Math.min(Math.round((70 - rsiValue) * 2), 100),
      })
    ),
    Match.when(
      ({ priceAction, rsiValue }) => priceAction === "LOWER_LOW" && rsiValue > 30,
      ({ rsiValue }) => ({
        hasDivergence: true,
        divergenceType: "BULLISH" as const,
        strength: Math.min(Math.round((rsiValue - 30) * 2), 100),
      })
    ),
    Match.orElse(() => ({ hasDivergence: false, divergenceType: "NONE" as const, strength: 0 }))
  );

// Detect RSI divergence
export const detectRSIDivergence = (price: CryptoPrice, rsi: RSIResult): RSIDivergenceSignal =>
  pipe(
    Option.all({ ath: Option.fromNullable(price.ath), atl: Option.fromNullable(price.atl) }),
    Option.map(({ ath, atl }) => {
      const priceToATH = price.price / ath;
      const priceToATL = price.price / atl;
      const priceAction = classifyPriceAction({ priceToATH, priceToATL });
      const divergence = detectDivergenceFromAction(priceAction, rsi.rsi);
      return { priceAction, ...divergence };
    }),
    Option.getOrElse(() => ({
      priceAction: "NEUTRAL" as const,
      hasDivergence: false,
      divergenceType: "NONE" as const,
      strength: 0,
    })),
    (result) => ({
      symbol: price.symbol,
      hasDivergence: result.hasDivergence,
      divergenceType: result.divergenceType,
      strength: result.strength,
      rsi: rsi.rsi,
      priceAction: result.priceAction,
    })
  );

// Effect-based divergence detection
export const detectDivergence = (price: CryptoPrice): Effect.Effect<RSIDivergenceSignal> =>
  Effect.gen(function* () {
    const rsi = yield* computeRSI(price);
    return detectRSIDivergence(price, rsi);
  });
