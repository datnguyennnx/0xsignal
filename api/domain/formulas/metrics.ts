import type { CryptoPrice, MarketMetrics } from "@0xsignal/shared";
import { calculateBollingerBands } from "./volatility";
import { calculateRSI } from "./momentum";

// ============================================================================
// MARKET METRICS CALCULATIONS
// ============================================================================
// Traditional market metrics enhanced with quantitative formulas
// Pure functional approach - no side effects
// ============================================================================

/**
 * Pure function to calculate market metrics from price data
 */
export const calculateMetrics = (price: CryptoPrice): MarketMetrics => {
  const volumeToMarketCapRatio = price.volume24h / price.marketCap;

  // Traditional volatility (Parkinson's volatility estimator)
  const volatility =
    price.high24h && price.low24h ? (price.high24h - price.low24h) / price.price : 0.5;

  return {
    symbol: price.symbol,
    volatility,
    liquidityScore: Math.min(volumeToMarketCapRatio * 100, 1),
    volumeToMarketCapRatio,
    priceToATH: price.ath ? price.price / price.ath : undefined,
    priceToATL: price.atl ? price.price / price.atl : undefined,
    timestamp: price.timestamp,
  };
};

/**
 * Pure function to calculate enhanced metrics with quant techniques
 * Combines traditional metrics with Bollinger Bands and RSI
 */
export const calculateEnhancedMetrics = (price: CryptoPrice) => {
  const baseMetrics = calculateMetrics(price);
  const bollingerBands = calculateBollingerBands(price.price, price.high24h, price.low24h);
  const rsi = calculateRSI(price.price, price.change24h, price.ath, price.atl);

  return {
    ...baseMetrics,
    bollingerBands,
    rsi,
    // Composite risk score (0-100)
    quantRiskScore: calculateQuantRiskScore(bollingerBands, rsi, baseMetrics.volatility),
  };
};

/**
 * Pure function to calculate composite risk score using quant metrics
 *
 * Combines:
 * - Bollinger Bands position (30%)
 * - RSI overbought/oversold (40%)
 * - Volatility (30%)
 */
export const calculateQuantRiskScore = (
  bollingerBands: ReturnType<typeof calculateBollingerBands>,
  rsi: ReturnType<typeof calculateRSI>,
  volatility: number
): number => {
  // Bollinger Bands risk: higher when outside bands
  const bbRisk = Math.abs(bollingerBands.percentB - 0.5) * 2; // 0-1

  // RSI risk: higher when overbought or oversold
  const rsiRisk = Math.abs(rsi.rsi - 50) / 50; // 0-1

  // Volatility risk: normalized
  const volRisk = Math.min(volatility, 1); // 0-1

  // Weighted composite score
  const compositeRisk = bbRisk * 0.3 + rsiRisk * 0.4 + volRisk * 0.3;

  return Math.round(compositeRisk * 100);
};
