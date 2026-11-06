/**
 * Indicator calculations - shared between frontend and backend
 * Pure functions using shared math utilities
 */

import type { ChartDataPoint } from "../types/chart";
import type { BandIndicatorDataPoint } from "./types";
import { calculateEMA } from "./calculators/trend";
import { calculateATR } from "./calculators/volatility";

// Trend indicators
export {
  calculateADX,
  calculateEMA,
  calculateHMA as calculateHMAIndicator,
  calculateParabolicSAR,
  calculateSMA,
  calculateSuperTrend,
  calculateVWMA,
  calculateWMA as calculateWMAIndicator,
} from "./calculators/trend";

// Volatility indicators
export {
  calculateATR,
  calculateBollingerBands,
  calculateDonchianChannels,
} from "./calculators/volatility";

export function calculateKeltnerChannels(
  data: ChartDataPoint[],
  period: number = 20,
  multiplier: number = 2,
): BandIndicatorDataPoint[] {
  const middleSeries = calculateEMA(data, period);
  const atrSeries = calculateATR(data, period);
  const result: BandIndicatorDataPoint[] = [];
  const offset = data.length - atrSeries.length;
  for (let i = 0; i < atrSeries.length; i++) {
    const index = i + offset;
    if (index < 0 || index >= middleSeries.length) continue;
    const m = middleSeries[index];
    const atr = atrSeries[i].value;
    result.push({
      time: atrSeries[i].time,
      upper: m.value + multiplier * atr,
      middle: m.value,
      lower: m.value - multiplier * atr,
    });
  }
  return result;
}

// Momentum indicators
export {
  calculateAwesomeOscillator as calculateAO,
  calculateCCI,
  calculateMACDLine,
  calculateMomentum,
  calculateROC,
  calculateRSI,
  calculateStochasticK,
  calculateTSI,
  calculateUltimateOscillator as calculateUO,
  calculateWilliamsR,
} from "./calculators/momentum";

// Volume indicators
export {
  calculateADLine,
  calculateCMF,
  calculateMFI,
  calculateNVI,
  calculateOBV,
  calculatePVT,
  calculateVWAP,
} from "./calculators/volume";

// Statistics indicators
export {
  calculateRegressionSlope as calculateLinRegSlopeIndicator,
  calculateStandardDeviation as calculateStdDevIndicator,
  calculateZScore as calculateZScoreIndicator,
} from "./calculators/statistics";

// Regime indicators
export {
  calculateATRP as calculateATRPIndicator,
  calculateChoppiness as calculateChoppinessIndicator,
  calculateEfficiencyRatio as calculateEfficiencyRatioIndicator,
} from "./calculators/regime";

// Advanced indicators
export {
  calculateDVO as calculateDVOIndicator,
  calculateKRI as calculateKRIIndicator,
  calculateSTC as calculateSTCIndicator,
  calculateVortexSpread as calculateVortexIndicator,
  calculateVZO as calculateVZOIndicator,
} from "./calculators/advanced";

// Quant indicators
export {
  calculateAroonOscillator as calculateAroonOscillatorIndicator,
  calculateChaikinOscillator as calculateChaikinOscillatorIndicator,
  calculateEaseOfMovement as calculateEOMIndicator,
  calculateHistoricalVolatility as calculateHistoricalVolatilityIndicator,
  calculatePPO as calculatePPOIndicator,
  calculateStochRSI as calculateStochRSIIndicator,
  calculateTRIX as calculateTRIXIndicator,
  calculateVolumeOscillator as calculateVolumeOscillatorIndicator,
} from "./calculators/quant";
