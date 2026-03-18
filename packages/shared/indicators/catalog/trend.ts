import type { IndicatorConfig } from "../types";
import { intParam, floatParam } from "./params";

export const TREND_INDICATORS: IndicatorConfig[] = [
  {
    id: "sma",
    name: "Simple Moving Average",
    category: "trend",
    description: "Arithmetic mean of price over a fixed lookback window.",
    defaultParams: { period: 20 },
    params: [intParam("period", "Period", 1, 500, 1)],
    usage: {
      whatItDoes:
        "Smooths out price volatility to reveal the underlying trend direction. It treats every data point in the window with equal weight.",
      whenToUse:
        "Identifying long-term trend bias (e.g., 200 SMA) and major structural support/resistance levels.",
      formula: "SMA = \\frac{\\sum_{i=1}^n C_i}{n}",
      mathematicalWeaknesses:
        "Highest lag among all moving averages; equal weighting causes 'echo' effects; susceptible to outliers at both ends of the window.",
      regimePerformance:
        "Trending: High (baseline). Ranging: Low (mean-reversion magnet). Low Vol: Moderate.",
      comparisons:
        "vs. EMA: SMA is slower but more 'reliable' for long-term institutional levels (e.g. the daily 200 SMA).",
      upgrades:
        "Adaptive SMA (AMA); offset SMA to reduce centering bias; combining multiple SMAs (Golden Cross).",
      tips: [
        "The slope of the 50 SMA is often more important than the price cross itself.",
        "Price staying above the 20 SMA identifies a High-Momentum trend.",
      ],
      pitfalls: [
        "Avoid using stand-alone SMA crosses in sideways markets; they are the definition of 'laggy loss-makers'.",
      ],
    },
    output: "line",
    allowMultiple: true,
    overlayOnPrice: true,
    paneIndexRecommendation: 0,
  },
  {
    id: "ema",
    name: "Exponential Moving Average",
    category: "trend",
    description: "Faster-responding moving average with recursive weighting.",
    defaultParams: { period: 20 },
    params: [intParam("period", "Period", 1, 500, 1)],
    usage: {
      whatItDoes:
        "Applies more weight to the most recent price data, making it more responsive to new information and trend reversals than an SMA.",
      whenToUse: "Active trend-following, momentum scalping, and short-term pullback entries.",
      formula:
        "EMA_t = C_t \\times \\alpha + EMA_{t-1} \\times (1-\\alpha) \\\\ \\alpha = \\frac{2}{n+1}",
      mathematicalWeaknesses:
        "Recursive nature means initial values impact results (requires warm-up); more prone to whipsaws than SMA during noise expansions.",
      regimePerformance: "Trending: High. High-Vol: Moderate. Low-Vol: Low.",
      comparisons:
        "vs. SMA: EMA reacts faster to price turns. vs. HMA: EMA has more lag but more 'consistent' trend slope.",
      upgrades:
        "Double EMA (DEMA) and Triple EMA (TEMA) for extreme lag reduction; volume-weighting the alpha coefficient.",
      tips: ["The 21 EMA is a favorite for intraday trend support in crypto."],
      pitfalls: ["EMA crossovers in narrow ranges result in rapid capital decay due to whipsaws."],
    },
    output: "line",
    allowMultiple: true,
    overlayOnPrice: true,
    paneIndexRecommendation: 0,
  },
  {
    id: "vwma",
    name: "Volume Weighted Moving Average",
    category: "trend",
    description: "Weights price by volume to highlight high-conviction trends.",
    defaultParams: { period: 20 },
    params: [intParam("period", "Period", 1, 500, 1)],
    usage: {
      whatItDoes:
        "Smooths price while ensuring that candles with high volume have a greater impact on the average than low-volume candles.",
      whenToUse:
        "Validating trend strength: rising VWMA with rising price confirms conviction. Divergence suggests weak 'retail' moves.",
      formula: "VWMA = \\frac{\\sum_{i=1}^n Price_i \\times Volume_i}{\\sum_{i=1}^n Volume_i}",
      mathematicalWeaknesses:
        "Extreme volume spikes (outliers) can cause 'shelving' or sharp steps in the average; more complex to compute in real-time.",
      regimePerformance: "High-Vol: Excellent. Trending: High. Low-Vol: Moderate.",
      comparisons:
        "vs. SMA: VWMA stays closer to price during heavy accumulation/distribution phases. vs. VWAP: VWMA is a rolling window; VWAP is typically session-based.",
      upgrades:
        "Volume-Zone-normalizing the weights; combining with MFI for 'True' trend strength.",
      tips: ["Watch for VWMA to cross SMA as a signal of institutional volume participation."],
      pitfalls: [
        "In very low volume pairs, VWMA behaves identically to SMA, losing its unique edge.",
      ],
    },
    output: "line",
    allowMultiple: false,
    overlayOnPrice: true,
    paneIndexRecommendation: 0,
  },
  {
    id: "wma",
    name: "Weighted Moving Average",
    category: "trend",
    description: "Linearly weighted average favoring current price.",
    defaultParams: { period: 20 },
    params: [intParam("period", "Period", 1, 500, 1)],
    usage: {
      whatItDoes:
        "Applies a linear multiplier to each price point (n, n-1, ...) such that newer points have significantly more influence than older ones.",
      whenToUse: "Medium-term trend tracking with less lag than SMA but more stability than EMA.",
      formula:
        "WMA = \\frac{\\sum_{i=1}^n Price_{n-i+1} \\times (n-i+1)}{W} \\\\ W = \\frac{n(n+1)}{2}",
      mathematicalWeaknesses:
        "Linear decline may not capture the 'momentum decay' of news events as well as EMA's exponential curve.",
      regimePerformance: "Trending: High. High-Vol: Moderate.",
      comparisons:
        "vs. SMA: Much more reactive. vs. EMA: Often considered smoother in quiet markets, though more laggy in crashes.",
      upgrades: "Triangular Smoothing (applying a second WMA on the first).",
      tips: [
        "WMA is often the base for more advanced oscillators like the Awesome Oscillator or CCI.",
      ],
      pitfalls: ["WMA periods shouldn't be too short (< 7) or it becomes extremely jagged."],
    },
    output: "line",
    allowMultiple: false,
    overlayOnPrice: true,
    paneIndexRecommendation: 0,
  },
  {
    id: "hma",
    name: "Hull Moving Average",
    category: "trend",
    description: "Zero-lag smoothing average for fast-moving markets.",
    defaultParams: { period: 21 },
    params: [intParam("period", "Period", 2, 500, 1)],
    usage: {
      whatItDoes:
        "Solves the lag problem by using the square root of the period for the final WMA smoothing step after calculating a 'raw' difference of two WMAs.",
      whenToUse:
        "Visualizing fast trend turns and identifying peak/trough structures with minimal delay.",
      formula: "HMA = WMA(2 \\times WMA(n/2) - WMA(n), \\sqrt{n})",
      mathematicalWeaknesses:
        "Tends to overshoot the price (ringing), especially in sideways regimes; prone to being 'too fast' for macro trend signal confirmation.",
      regimePerformance:
        "Trending: High (stays tight to price). High-Vol: Excellent. Ranging: Low (frequent whipsaws).",
      comparisons:
        "vs. EMA/SMA: HMA is significantly faster and 'hugs' the actual price path better.",
      upgrades:
        "Jurik Smoothing (JMA) is the only real upgrade to HMA for professional lag-reduction.",
      tips: ["Look at the slope of HMA; color-coding the slope can provide early exit signals."],
      pitfalls: [
        "DO NOT use HMA for standard SMA-style support/resistance. It is too reactive for 'bounces'.",
      ],
    },
    output: "line",
    allowMultiple: false,
    overlayOnPrice: true,
    paneIndexRecommendation: 0,
  },
  {
    id: "superTrend",
    name: "SuperTrend",
    category: "trend",
    description: "Volatility-adjusted directional trend guide.",
    defaultParams: { period: 10, multiplier: 3 },
    params: [
      intParam("period", "ATR Period", 1, 200, 1),
      floatParam("multiplier", "ATR Multiplier", 0.5, 10, 0.1),
    ],
    usage: {
      whatItDoes:
        "Uses ATR to define a 'boundary' around price (HL2). If price crosses the boundary, a trend reversal is registered.",
      whenToUse: "Trailing stops, trend confirmation filters, and aggressive breakout strategies.",
      formula: "\\text{Upper} = HL2 + (m \\times ATR) \\\\ \\text{Lower} = HL2 - (m \\times ATR)",
      mathematicalWeaknesses:
        "Purely reactive to ATR; vulnerable to 'volatility clusters' (e.g. sharp wick flips); constant re-calculation based on price extremes.",
      regimePerformance: "Trending: High. Ranging: Poor (heavy whipsaw). Volatile: Moderate.",
      comparisons:
        "vs. Parabolic SAR: SuperTrend is often more robust but slower. vs. Moving Averages: SuperTrend is explicitly volatility-aware.",
      upgrades:
        "SuperTrend with Multiple Multipliers; Using HMA for the internal baseline to reduce lag.",
      tips: [
        "Pair SuperTrend with a long-term EMA (e.g. 200) — only take 'Long' signals when price is > EMA.",
      ],
      pitfalls: ["Avoid standalone use in high-noise, random walk segments (CHOP index > 50)."],
    },
    output: "line",
    allowMultiple: false,
    overlayOnPrice: true,
    paneIndexRecommendation: 0,
  },
  {
    id: "parabolicSAR",
    name: "Parabolic SAR",
    category: "trend",
    description: "Time-price stop and reverse accelerator.",
    defaultParams: { step: 0.02, maxStep: 0.2 },
    params: [
      floatParam("step", "Step", 0.001, 1, 0.001),
      floatParam("maxStep", "Max Step", 0.01, 2, 0.01),
    ],
    usage: {
      whatItDoes:
        "Moves a 'Stop' point closer to the price every candle, accelerating as the trend makes new highs/lows. It forces a trade exit when the price eventually stalls or reverses.",
      whenToUse: "Aggressive trailing stops and detecting trend exhaustion phases.",
      formula: "SAR_t = SAR_{t-1} + AF \\times (EP - SAR_{t-1})",
      mathematicalWeaknesses:
        "Acceleration Factor (AF) logic assume trends always accelerate (linear bias); prone to mass whipsaws in consolidation.",
      regimePerformance: "Parabolic Trends: High. Ranging: Abysmal. Step-wise Trends: Moderate.",
      comparisons:
        "vs. SuperTrend: SAR is much more aggressive and sensitive to time. SuperTrend focuses on volatility range.",
      upgrades: "Adjusting AF based on RSI or ADX strength to slow down stops in weak moves.",
      tips: ["The first 3 dots after a flip are the most risky; wait for trend confirmation."],
      pitfalls: [
        "Using PSAR in a ranging market is the fastest way to blow through a trading account via tiny paper cuts.",
      ],
    },
    output: "dots",
    allowMultiple: false,
    overlayOnPrice: true,
    paneIndexRecommendation: 0,
  },
  {
    id: "adx",
    name: "Average Directional Index",
    category: "trend",
    description: "Quantifies core trend strength, irrespective of direction.",
    defaultParams: { period: 14 },
    params: [intParam("period", "Period", 1, 300, 1)],
    usage: {
      whatItDoes:
        "Calculates the smoothed DX (Directional Index) based on the relationship between +DI and -DI, providing a single line between 0 and 100.",
      whenToUse:
        "Determining whether to use trend-following or mean-reversion strategies. Validating breakout strength.",
      formula: "DX = 100 \\times \\frac{|+DI - -DI|}{+DI + -DI} \\\\ ADX = EMA(DX, n)",
      mathematicalWeaknesses:
        "Highly lagging (Double smoothed); trend direction is lost; sensitive to ADX periods; can plateau during strong trends.",
      regimePerformance: "High-Trend: High. Ranging: High (identifies the lack of trend).",
      comparisons:
        "vs. Chop Index: Both measure trendiness, but ADX is based on DI (momentum-directional) while Chop is based on fractal efficiency.",
      upgrades: "DMI-oscillator; using ADX slope to detect trend acceleration.",
      tips: [
        "ADX > 25 indicates a confirmed trending regime.",
        "ADX declining from a high peak (> 40) often precedes a major distribution phase.",
      ],
      pitfalls: [
        "Do not buy just because ADX is high; it might be at the absolute top of the trend.",
      ],
    },
    output: "line",
    allowMultiple: false,
    overlayOnPrice: false,
    paneIndexRecommendation: 1,
  },
];
