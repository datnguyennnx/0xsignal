import type { IndicatorConfig } from "../types";
import { intParam } from "./params";

export const REGIME_INDICATORS: IndicatorConfig[] = [
  {
    id: "atrp",
    name: "Average True Range Percentage",
    category: "regime",
    description: "Normalized volatility as a percentage of price.",
    defaultParams: { period: 14 },
    params: [intParam("period", "Period", 2, 400, 1)],
    usage: {
      whatItDoes:
        "Divides ATR by the current price to provide a unit-less volatility metric. Allows comparison of volatility across assets regardless of their nominal price.",
      whenToUse:
        "Cross-asset volatility ranking, dynamic position sizing, and identifying 'High Vol' market regimes.",
      formula: "ATRP = \\frac{ATR(n)}{Close} \\times 100",
      mathematicalWeaknesses:
        "Sensitivity to absolute price levels (division bias); reacts slowly to sudden price crashes unless the period is very short.",
      regimePerformance: "High-Vol: High. Low-Vol: Low (baseline).",
      comparisons:
        "vs. ATR: ATRP is mandatory for comparing BTC ($60k) volatility to Altcoins ($1).",
      upgrades: "Annualized ATRP for integration into Sharpe/Sortino models.",
      tips: ["Useful for defining a 'Volatility Cap' for automated trading systems."],
      pitfalls: [
        "During flash crashes, the denominator (price) drops while numerator (ATR) spikes, causing extreme ATRP outliers.",
      ],
    },
    output: "line",
    allowMultiple: false,
    overlayOnPrice: false,
    paneIndexRecommendation: 2,
  },
  {
    id: "chop",
    name: "Choppiness Index",
    category: "regime",
    description: "Fractal-based indicator to distinguish trend from congestion.",
    defaultParams: { period: 14 },
    params: [intParam("period", "Period", 5, 300, 1)],
    usage: {
      whatItDoes:
        "Measures whether market action is trending or ranging using fractal geometry. It calculates the efficiency of the price path over N periods.",
      whenToUse:
        "Switching between trend-following (Low CHOP) and mean-reversion (High CHOP) strategies.",
      formula:
        "CHOP = 100 \\times \\log_{10} \\left( \\frac{\\sum_{i=1}^n TR_i}{\\max(H_n) - \\min(L_n)} \\right) / \\log_{10}(n)",
      mathematicalWeaknesses:
        "Log-scale normalization can be slow to react; requires significant lookback (~14+) to be mathematically robust.",
      regimePerformance: "Trend: Low (< 38.2). Chop: High (> 61.8).",
      comparisons:
        "vs. ADX: CHOP is arguably deeper as it looks at the efficiency of the whole path, not just directional momentum.",
      upgrades: "Using Jurik ATR for the TR summation; smoothing with a 5-period EMA.",
      tips: [
        "CHOP < 38.2 suggests a strong trend is underway.",
        "CHOP > 61.8 suggests the market is in 'exhaustion' or sideways congestion.",
      ],
      pitfalls: [
        "High CHOP doesn't tell you the direction of the next move; only that the current move is inefficient.",
      ],
    },
    output: "line",
    allowMultiple: false,
    overlayOnPrice: false,
    paneIndexRecommendation: 1,
  },
  {
    id: "efficiencyRatio",
    name: "Efficiency Ratio (Kaufman)",
    category: "regime",
    description: "Signal-to-noise ratio of price movement.",
    defaultParams: { period: 10 },
    params: [intParam("period", "Period", 2, 300, 1)],
    usage: {
      whatItDoes:
        "Calculates the ratio of the net price move to the sum of absolute price moves. Higher values imply a cleaner directional signal with less noise.",
      whenToUse:
        "Adaptive strategy selection (e.g. automating period changes in KAMA) and filtering breakout trades.",
      formula:
        "ER = \\frac{|Close_t - Close_{t-n}|}{\\sum_{i=0}^{n-1} |Close_{t-i} - Close_{t-i-1}|}",
      mathematicalWeaknesses:
        "Sensitivity to minor price vibrations; un-normalized for volatility; tends to crash to zero in sideways periods.",
      regimePerformance: "Clean Trend: High (approaching 1.0). Noise: Low (approaching 0).",
      comparisons: "vs. CHOP: ER is simpler and focuses on price path 'waste'.",
      upgrades: "Volatility-weighted ER; Log-scaling the denominator.",
      tips: ["An ER > 0.6 is often a prerequisite for a high-conviction breakout."],
      pitfalls: ["Very short periods (n < 5) generate too much signal noise."],
    },
    output: "line",
    allowMultiple: false,
    overlayOnPrice: false,
    paneIndexRecommendation: 1,
  },
];
