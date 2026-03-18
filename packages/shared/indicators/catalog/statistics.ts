import type { IndicatorConfig } from "../types";
import { intParam } from "./params";

export const STATISTICS_INDICATORS: IndicatorConfig[] = [
  {
    id: "zscore",
    name: "Z-Score",
    category: "adaptive",
    description: "Rolling standardized distance from the mean.",
    defaultParams: { period: 30 },
    params: [intParam("period", "Period", 5, 500, 1)],
    usage: {
      whatItDoes:
        "Standardizes price by subtracting the rolling mean and dividing by the rolling standard deviation. This expresses the current price's distance from the average in terms of 'Standard Deviations'.",
      whenToUse:
        "Identifying extreme statistical anomalies and mean-reversion opportunities (Pairs trading, overextensions).",
      formula: "Z = \\frac{C_t - \\text{SMA}(n)}{\\text{StdDev}(n)}",
      mathematicalWeaknesses:
        "Assumes a normal distribution of returns (which markets rarely have, i.e., Fat Tails); sensitive to the lookback period; non-directional.",
      regimePerformance: "Ranging: High. Trending: Low (pegging risk). Low-Vol: Moderate.",
      comparisons:
        "vs. Bollinger %B: Z-Score is the raw 'distance' component of Bollinger Bands without the fixed boundaries.",
      upgrades: "Using an EMA for the mean and a GARCH-style estimator for the denominator.",
      tips: ["Z-Scores > +2.5 or < -2.5 are rare and often precede mean-reversion spikes."],
      pitfalls: [
        "In a true parabolic trend, Z-Score can stay at +3.0 for weeks while the asset continues to rise.",
      ],
    },
    output: "line",
    allowMultiple: false,
    overlayOnPrice: false,
    paneIndexRecommendation: 1,
  },
  {
    id: "stddev",
    name: "Standard Deviation",
    category: "volatility",
    description: "Rolling measure of price dispersion.",
    defaultParams: { period: 20 },
    params: [intParam("period", "Period", 5, 500, 1)],
    usage: {
      whatItDoes:
        "Calculates the square root of the variance of price over a rolling window. It quantifies the 'volatility' or noise level of the current market segment.",
      whenToUse:
        "Volatility targeting, defining safe-stop distances, and identifying 'Quiet' before 'Storm' (Squeezes).",
      formula: "\\sigma = \\sqrt{\\frac{1}{n} \\sum_{i=1}^n (C_i - \\bar{C})^2}",
      mathematicalWeaknesses:
        "Equally weights all data points in the window; sensitive to large one-off price spikes (outliers).",
      regimePerformance: "Volatile: High. Trending: Moderate.",
      comparisons:
        "vs. ATR: StdDev is based on Closes; ATR is based on Ranges (High-Low). ATR is generally more robust for stop-losses.",
      upgrades: "Exponential Standard Deviation (giving more weight to recent volatility).",
      tips: ["A flat or declining StdDev often precedes a major volatility expansion."],
      pitfalls: [
        "StdDev is not directional. A high StdDev simply means 'fast movement', not necessarily 'up' or 'down'.",
      ],
    },
    output: "line",
    allowMultiple: false,
    overlayOnPrice: false,
    paneIndexRecommendation: 2,
  },
  {
    id: "linRegSlope",
    name: "Linear Regression Slope",
    category: "trend",
    description: "The rate of change of the best-fit line.",
    defaultParams: { period: 50 },
    params: [intParam("period", "Period", 5, 500, 1)],
    usage: {
      whatItDoes:
        "Uses the Least Squares method to find the best linear fit for the price data over N candles, then returns the 'slope' of that line.",
      whenToUse:
        "Quantifying trend acceleration and identifying momentum exhaustion (when slope starts to flatten).",
      formula: "Slope = \\frac{n\\sum xy - \\sum x\\sum y}{n\\sum x^2 - (\\sum x)^2}",
      mathematicalWeaknesses:
        "Assumes linear price movement; sensitive to 'gap' openings; high lag for long periods.",
      regimePerformance: "Trending: High. Parabolic: Poor. Side-ways: Moderate (around zero).",
      comparisons:
        "vs. Momentum (ROC): Slope is a 'best-fit' measure; ROC is a 'point-to-point' measure. Slope is much smoother.",
      upgrades: "Combining Slope with R-Squared to only trade trends with high statistical 'fit'.",
      tips: [
        "Divergence in Slope (e.g. Price making HH but Slope making LH) is a powerful reversal lead.",
      ],
      pitfalls: ["Standalone Slope signals are reactive; always combine with price-action levels."],
    },
    output: "line",
    allowMultiple: false,
    overlayOnPrice: false,
    paneIndexRecommendation: 1,
  },
];
