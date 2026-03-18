import type { IndicatorConfig } from "../types";
import { intParam } from "./params";

export const MOMENTUM_INDICATORS: IndicatorConfig[] = [
  {
    id: "rsi",
    name: "Relative Strength Index",
    category: "momentum",
    description: "Measures internal strength by comparing average gains vs. average losses.",
    defaultParams: { period: 14 },
    params: [intParam("period", "Period", 1, 300, 1)],
    usage: {
      whatItDoes:
        "Measures the velocity and magnitude of directional price movements. Normalized between 0 and 100 using Wilder's smoothing.",
      whenToUse:
        "Identifying momentum exhaustion, rotational pivots, and divergence patterns in range-bound or early-trend phases.",
      formula: "RSI = 100 - \\frac{100}{1 + \\frac{\\text{Average Gain}}{\\text{Average Loss}}}",
      mathematicalWeaknesses:
        "Lag due to Wilder's EMA-style smoothing; fixed boundaries ignore volatility expansion (pegging risk); sensitive to price spikes in low cycles.",
      regimePerformance:
        "Ranging: High (excellent mean-reversion signals). Trending: Moderate (often stays >70 or <30 for long periods). High Vol: Noisy.",
      comparisons:
        "vs. Stochastic: RSI is smoother but slower. vs. MACD: RSI captures local overextension better than trend momentum.",
      upgrades:
        "Adaptive lookback (Ehlers/Kaufman); Lag-reduction via Jurik or Zero-Lag filtering; Volume-weighting averages.",
      tips: [
        "RSI > 40 is a common support zone for strong bull markets.",
        "RSI divergence + Volume expansion = High-probability reversal signal.",
        "Look for 'failure swings' for early entry confirmation.",
      ],
      pitfalls: [
        "In strong trends, RSI stays 'overbought' while price keeps rising.",
        "Fixed thresholds (70/30) are sub-optimal for high-volatility assets.",
      ],
    },
    output: "line",
    allowMultiple: false,
    overlayOnPrice: false,
    paneIndexRecommendation: 1,
    implementationNotesForDev:
      "Requires warm-up of at least 2.5 * period for stable calculation. Calculate over Close price.",
  },
  {
    id: "macd",
    name: "Moving Average Convergence Divergence",
    category: "momentum",
    description: "Compares fast vs. slow trend momentum via exponential smoothing.",
    defaultParams: { fast: 12, slow: 26, signal: 9 },
    params: [
      intParam("fast", "Fast EMA", 1, 250, 1),
      intParam("slow", "Slow EMA", 1, 400, 1),
      intParam("signal", "Signal", 1, 100, 1),
    ],
    usage: {
      whatItDoes:
        "Captures the interaction between two trend-following averages. The spread (MACD line) shows acceleration/deceleration.",
      whenToUse:
        "Following trend continuation, spot cycle shifts, and momentum acceleration (histogram expansion).",
      formula:
        "\\text{MACD} = EMA(fast) - EMA(slow) \\\\ \\text{Signal} = EMA(\\text{MACD}, sig) \\\\ \\text{Hist} = \\text{MACD} - \\text{Signal}",
      mathematicalWeaknesses:
        "Centered oscillator with no upper/lower bounds; lagging signal line; scale-dependency (not cross-asset comparable).",
      regimePerformance:
        "Trending: High (best for pullbacks). Ranging: Low (frequent whipsaws). High Vol: Moderate.",
      comparisons:
        "vs. PPO: PPO is percentage-based and superior for cross-asset scans. vs. RSI: MACD is trend-following, RSI is mean-reverting.",
      upgrades:
        "Zero-Lag (DEMA/TEMA) internal smoothing; adaptive parameters based on Dominant Cycle (Ehlers); Impulse filtering.",
      tips: [
        "MACD histogram expansion precedes price breakout in many high-alpha setups.",
        "Zero-line crossovers are often late; look for histogram peaks.",
      ],
      pitfalls: ["Avoid MACD in low-volatility sideways chop; signals are unreliable."],
    },
    output: "histogram",
    allowMultiple: false,
    overlayOnPrice: false,
    paneIndexRecommendation: 1,
    implementationNotesForDev:
      "Calculate as 12/26 EMA spread by default. Use Histogram for visual clarity in LightWeight Charts.",
  },
  {
    id: "ao",
    name: "Awesome Oscillator",
    category: "momentum",
    description: "Gap between 5-bar and 34-bar SMAs of median price.",
    defaultParams: { fast: 5, slow: 34 },
    params: [intParam("fast", "Fast SMA", 1, 200, 1), intParam("slow", "Slow SMA", 2, 400, 1)],
    usage: {
      whatItDoes:
        "Uses short-vs-long median price averages (H+L)/2 to define current momentum momentum direction and strength.",
      whenToUse:
        "Detecting zero-line crosses (momentum shift) and 'Twin Peaks' divergence patterns.",
      formula:
        "\\mathrm{AO} = \\mathrm{SMA}(\\text{Median}, 5) - \\mathrm{SMA}(\\text{Median}, 34)",
      mathematicalWeaknesses:
        "Significant lag from SMA; sensitive to flash-spikes in median price; un-normalized (hard to compare across tickers).",
      regimePerformance:
        "Trending: Moderate. Ranging: Low. High Vol: High (helps filter candle wicks).",
      comparisons:
        "vs. MACD: AO uses median price and SMA (no weighted smoothing); AO is typically slower but arguably more robust to outlier closes.",
      upgrades: "Adaptive SMA periods based on cycle length; Volume-weighting the median price.",
      tips: ["Look for 'Saucer' patterns on the histogram for pull-back entries."],
      pitfalls: ["Lag makes zero-crosses expensive in fast reversal markets."],
    },
    output: "histogram",
    allowMultiple: false,
    overlayOnPrice: false,
    paneIndexRecommendation: 1,
  },
  {
    id: "uo",
    name: "Ultimate Oscillator",
    category: "momentum",
    description: "Multi-timeframe momentum integration to reduce single-period noise.",
    defaultParams: { short: 7, medium: 14, long: 28 },
    params: [
      intParam("short", "Short Period", 2, 200, 1),
      intParam("medium", "Medium Period", 3, 300, 1),
      intParam("long", "Long Period", 4, 600, 1),
    ],
    usage: {
      whatItDoes:
        "Normalizes buying pressure across three windows to weight short, medium, and long-term momentum impacts.",
      whenToUse:
        "Identifying momentum divergence and breakouts while filtering out single-lookback noise.",
      formula: "UO = 100 \\times \\frac{4 \\times Avg_7 + 2 \\times Avg_{14} + Avg_{28}}{4+2+1}",
      mathematicalWeaknesses:
        "Complex weight dependency; calculation involves True Range (increases computation); sensitivity to period hierarchy.",
      regimePerformance: "Trending: Moderate. Ranging: High (filtered). Low-Vol: High.",
      comparisons: "vs. RSI: UO reduces 'pegging' risk at boundaries by using three cycles.",
      upgrades: "Log-True Range scaling; Volume-augmented buying pressure.",
      tips: [
        "Watch for the 50-line breakout after a bullish divergence.",
        "Wait for the oscillator to exceed 70/lower 30 for clear signals.",
      ],
      pitfalls: ["If parameters are too close, it collapses to a noisy RSI."],
    },
    output: "line",
    allowMultiple: false,
    overlayOnPrice: false,
    paneIndexRecommendation: 1,
  },
  {
    id: "stochastic",
    name: "Stochastic Oscillator",
    category: "momentum",
    description: "Compares current close to recent price range (High-Low).",
    defaultParams: { period: 14, smoothD: 3 },
    params: [intParam("period", "Period", 1, 300, 1), intParam("smoothD", "D Smoothing", 1, 50, 1)],
    usage: {
      whatItDoes:
        "Highlights where the close is relative to the recent high/low range, assuming prices tend to close near extremes in trends.",
      whenToUse: "Overbought/Oversold timing in ranging markets and momentum exhaustion.",
      formula:
        "\\%K = \\frac{\\text{Close} - \\text{Low}_{min}}{\\text{High}_{max} - \\text{Low}_{min}} \\times 100",
      mathematicalWeaknesses:
        "Extremely noisy (high gamma); hypersensitive to single news candles; risk of 'infinite pegging' in macro trends.",
      regimePerformance: "Trending: Poor. Ranging: High. Capable of being tuned for scalp-swings.",
      comparisons:
        "vs. Williams %R: Mathematically inverse, but Stoch typically has more smoothing options. vs. RSI: Stoch is more sensitive.",
      upgrades: "Double smoothing (Full Stochastic); adaptive range sizing based on ATR.",
      tips: ["Enter on %K crossing %D outside the 80/20 zones for better risk/reward."],
      pitfalls: ["Buying 20 oversold in a vertical dump is a classic 'catching the knife' error."],
    },
    output: "line",
    allowMultiple: false,
    overlayOnPrice: false,
    paneIndexRecommendation: 1,
  },
  {
    id: "williamsR",
    name: "Williams %R",
    category: "momentum",
    description: "Inverted price channel oscillator (-100 to 0).",
    defaultParams: { period: 14 },
    params: [intParam("period", "Period", 1, 300, 1)],
    usage: {
      whatItDoes:
        "Determines overbought and oversold levels by evaluating the relationship between highest high and current close.",
      whenToUse:
        "Detecting swift price reversals and overextension in highly volatile price paths.",
      formula:
        "\\%R = \\frac{\\text{High}_{max} - \\text{Close}}{\\text{High}_{max} - \\text{Low}_{min}} \\times -100",
      mathematicalWeaknesses:
        "Flipped scale can be unintuitive; prone to false signals in strong trends without confirmation.",
      regimePerformance: "Trending: Moderate. Ranging: High. High Vol: Excellent.",
      comparisons:
        "vs. Stochastic: Very similar, but %R highlights 'bullish' strength by focus on high range.",
      upgrades: "Triple EMA smoothing (Williams-Smoothed); period normalization.",
      tips: ["Watch for failure to reach -80 to signal underlying trend weakness."],
      pitfalls: ["Avoid stand-alone use; signal line smoothing recommended."],
    },
    output: "line",
    allowMultiple: false,
    overlayOnPrice: false,
    paneIndexRecommendation: 1,
  },
  {
    id: "cci",
    name: "Commodity Channel Index",
    category: "momentum",
    description: "Measures typical price deviation from its SMAs.",
    defaultParams: { period: 20 },
    params: [intParam("period", "Period", 1, 500, 1)],
    usage: {
      whatItDoes:
        "Uses Mean Deviation to identify cyclical turns and trend acceleration beyond standard deviation bands.",
      whenToUse: "Detecting trend bursts (> +100) or mean-reversion exhaustion (< -100).",
      formula:
        "CCI = \\frac{\\text{TP} - \\text{SMA}(\\text{TP}, n)}{0.015 \\times \\text{Mean Deviation}}",
      mathematicalWeaknesses:
        "0.015 constant is arbitrary; Mean Deviation calculation is computationally heavier; non-bounded scale.",
      regimePerformance: "Trending: High (acceleration). Ranging: Moderate. Low Vol: Moderate.",
      comparisons:
        "vs. RSI: RSI is bounded; CCI is un-bounded and better at spotting extreme outlier momentum.",
      upgrades: "Gaussian smoothing filter; volatility-normalized constant (replacing 0.015).",
      tips: ["Crossing above +100 is often a 'momentum breakout' buy signal."],
      pitfalls: ["High noise in low-volatility regimes without Trend-Z entry filters."],
    },
    output: "line",
    allowMultiple: false,
    overlayOnPrice: false,
    paneIndexRecommendation: 1,
  },
  {
    id: "roc",
    name: "Rate of Change",
    category: "momentum",
    description: "Simple percentage change over fixed history.",
    defaultParams: { period: 12 },
    params: [intParam("period", "Period", 1, 500, 1)],
    usage: {
      whatItDoes:
        "Calculates pure momentum percentage. Useful for comparing relative velocity across different assets.",
      whenToUse:
        "Detecting momentum peaks and divergence when comparing speed vs. price price progression.",
      formula:
        "ROC = \\frac{\\text{Close}_t - \\text{Close}_{t-n}}{\\text{Close}_{t-n}} \\times 100",
      mathematicalWeaknesses:
        "Extremely sensitive to 'echo' effects (what happened n bars ago matters exactly as much as now).",
      regimePerformance: "Trending: High. Ranging: Poor (laggy). Cycle: High.",
      comparisons:
        "vs. Momentum: ROC is normalized (%), Momentum is absolute ($). ROC is always preferred for cross-asset.",
      upgrades: "Smoothing ROC output with WMA/EMA; normalizing for volatility (Sharpe-style ROC).",
      tips: ["Zero-line reclaim after a deep oversold peak signal trend resumption."],
      pitfalls: [
        "A large outlier candle n bars ago causes a false signal today when it drops off lookback.",
      ],
    },
    output: "line",
    allowMultiple: false,
    overlayOnPrice: false,
    paneIndexRecommendation: 1,
  },
  {
    id: "momentum",
    name: "Momentum ($)",
    category: "momentum",
    description: "Absolute price delta over lookback period.",
    defaultParams: { period: 10 },
    params: [intParam("period", "Period", 1, 500, 1)],
    usage: {
      whatItDoes: "Simplest momentum measurement: Current price minus Price(n).",
      whenToUse: "Confirming breakout velocity and local overextension in liquid assets.",
      formula: "Mom = \\text{Close}_t - \\text{Close}_{t-n}",
      mathematicalWeaknesses:
        "Not normalized (scale changes with price); non-stationary; high echo sensitivity.",
      regimePerformance: "Trending: Moderate. Ranging: Low. High Vol: Moderate.",
      comparisons:
        "vs. ROC: Use Momentum for single asset models where absolute $ delta matters (e.g. BTC futures context).",
      upgrades: "Volatility normalization; EMA integration.",
      tips: ["Best used with a moving average of the momentum itself."],
      pitfalls: ["Completely useless for cross-asset ranking due to lack of normalization."],
    },
    output: "line",
    allowMultiple: false,
    overlayOnPrice: false,
    paneIndexRecommendation: 1,
  },
  {
    id: "tsi",
    name: "True Strength Index",
    category: "momentum",
    description: "Double-smoothed momentum for clean directional signal.",
    defaultParams: { longPeriod: 25, shortPeriod: 13 },
    params: [
      intParam("longPeriod", "Long Period", 1, 400, 1),
      intParam("shortPeriod", "Short Period", 1, 200, 1),
    ],
    usage: {
      whatItDoes:
        "Uses double-exponential-smoothing to filter noise while highlighting the underlying momentum strength.",
      whenToUse:
        "Tracking long-term swing momentum and staying in trends longer with less noise than RSI.",
      formula:
        "\\text{TSI} = 100 \\times \\frac{EMA(EMA(PC, n), m)}{EMA(EMA(|PC|, n), m)} \\\\ PC = \\text{Close}_t - \\text{Close}_{t-1}",
      mathematicalWeaknesses:
        "Higher lag due to double-smoothing; less reactive to sudden mean-reversion spikes.",
      regimePerformance: "Trending: High. Ranging: Moderate. High Vol: Excellent (filters noise).",
      comparisons:
        "vs. RSI: TSI is smoother and arguably cleaner for trend confirmation. vs. MACD: TSI is bounded (-100 to 100).",
      upgrades: "Jurik-smoothing for reduced lag; adaptive lookback.",
      tips: ["Zero-line crosses signal long-term directional shifts."],
      pitfalls: ["Can miss the exact top/bottom due to smoothing lag."],
    },
    output: "line",
    allowMultiple: false,
    overlayOnPrice: false,
    paneIndexRecommendation: 1,
  },
];
