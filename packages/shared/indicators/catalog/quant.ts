import type { IndicatorConfig } from "../types";
import { intParam } from "./params";

export const QUANT_INDICATORS: IndicatorConfig[] = [
  {
    id: "ppo",
    name: "Percentage Price Oscillator",
    category: "momentum",
    description: "Normalized MACD expressed as a percentage.",
    defaultParams: { fast: 12, slow: 26 },
    params: [intParam("fast", "Fast EMA", 2, 200, 1), intParam("slow", "Slow EMA", 3, 400, 1)],
    usage: {
      whatItDoes:
        "Calculates the difference between two EMAs as a percentage of the slower EMA. This makes it a stationary oscillator that can be compared across assets with different prices.",
      whenToUse:
        "Cross-asset momentum comparison, identifying trend strength without price-scale bias.",
      formula: "PPO = \\frac{EMA_{fast} - EMA_{slow}}{EMA_{slow}} \\times 100",
      mathematicalWeaknesses:
        "Lag inherited from EMAs; centered oscillator (no boundaries); sensitive to the period hierarchy of the EMAs.",
      regimePerformance: "Trending: High. Ranging: Low (whipsaw).",
      comparisons:
        "vs. MACD: PPO is much better for backtesting across multiple assets or long timeframes where price changes significantly.",
      upgrades: "Using Volatility-normalized alpha for the internal EMAs.",
      tips: ["Look for PPO crosses near the zero-line for early trend-resumption signals."],
      pitfalls: ["Do not confuse PPO percentage with absolute price returns."],
    },
    output: "line",
    allowMultiple: false,
    overlayOnPrice: false,
    paneIndexRecommendation: 1,
  },
  {
    id: "trix",
    name: "TRIX",
    category: "momentum",
    description: "Triple-smoothed exponential moving average rate of change.",
    defaultParams: { period: 18 },
    params: [intParam("period", "Period", 2, 300, 1)],
    usage: {
      whatItDoes:
        "Smooths the price three times using EMA to filter out repetitive cycles shorter than the TRIX period, then calculates the 1-period rate of change.",
      whenToUse:
        "Identifying long-term momentum shifts while filtering out insignificant price 'noise' and minor corrections.",
      formula:
        "EMA1 = EMA(C, n) \\\\ EMA2 = EMA(EMA1, n) \\\\ EMA3 = EMA(EMA2, n) \\\\ TRIX = ROC(EMA3, 1)",
      mathematicalWeaknesses:
        "Extreme lag due to triple-smoothing; initial values take a long time to stabilize (long warm-up).",
      regimePerformance:
        "Trending: High (very clean). Ranging: High (filters noise). Reversal: Moderate.",
      comparisons:
        "vs. MACD: TRIX is much smoother and generates fewer but more reliable signals for swing traders.",
      upgrades: "Offsetting TRIX with its own EMA to create a signal line.",
      tips: ["Zero-line crossovers in TRIX are high-conviction signals for macro regime shifts."],
      pitfalls: ["Avoid using TRIX for scalping; it is too slow for intraday mean-reversion."],
    },
    output: "line",
    allowMultiple: false,
    overlayOnPrice: false,
    paneIndexRecommendation: 1,
  },
  {
    id: "stochRsi",
    name: "Stochastic RSI",
    category: "hybrid",
    description: "A stochastic transform of the RSI indicator.",
    defaultParams: { rsiPeriod: 14, stochPeriod: 14, smoothK: 3 },
    params: [
      intParam("rsiPeriod", "RSI Period", 2, 300, 1),
      intParam("stochPeriod", "Stoch Period", 2, 300, 1),
      intParam("smoothK", "Smooth K", 1, 50, 1),
    ],
    usage: {
      whatItDoes:
        "Applies the Stochastic formula to RSI values rather than price, making the indicator much more sensitive to momentum extremes.",
      whenToUse:
        "Aggressive mean-reversion entries and detecting 'hidden' overextension that raw RSI might miss.",
      formula: "StochRSI = \\frac{RSI_t - \\min(RSI_n)}{\\max(RSI_n) - \\min(RSI_n)}",
      mathematicalWeaknesses:
        "Hyper-sensitive; prone to frequent whipsaws; boundaries (0 and 1) are hit constantly, leading to 'peg' risk.",
      regimePerformance: "Ranging: High. Trending: Poor (pegged at extremes). Low-Vol: High.",
      comparisons: "vs. RSI: Stoch RSI is 'RSI on steroids'. It is much faster but much noisier.",
      upgrades:
        "Triple-smoothing the StochRSI output (Full StochRSI); using Jurik-RSI as the base.",
      tips: [
        "Look for trades only when StochRSI and absolute RSI both confirm overbought/oversold levels.",
      ],
      pitfalls: [
        "Buying an 'oversold' StochRSI in a strong downtrend without a regime filter is a death-trap.",
      ],
    },
    output: "line",
    allowMultiple: false,
    overlayOnPrice: false,
    paneIndexRecommendation: 1,
  },
  {
    id: "chaikinOsc",
    name: "Chaikin Oscillator",
    category: "moneyflow",
    description: "The momentum of the Accumulation/Distribution Line.",
    defaultParams: { fast: 3, slow: 10 },
    params: [intParam("fast", "Fast EMA", 2, 100, 1), intParam("slow", "Slow EMA", 3, 200, 1)],
    usage: {
      whatItDoes:
        "Calculates the difference between a 3-period EMA and a 10-period EMA of the Accumulation/Distribution Line. It detects changes in money flow momentum.",
      whenToUse:
        "Identifying accumulation/distribution accelerations and spotting divergences between price and volume-flow.",
      formula:
        "\\mathrm{ChaikinOsc} = \\mathrm{EMA}(\\text{AD}, 3) - \\mathrm{EMA}(\\text{AD}, 10)",
      mathematicalWeaknesses:
        "Sensitive to gaps and outliers in volume; can flip aggressively in low-liquidity markets.",
      regimePerformance: "Breakouts: High. Ranging: Moderate.",
      comparisons: "vs. MACD: Chaikin is essentially the MACD of volume-flow rather than price.",
      upgrades:
        "Adjusting EMA periods based on daily volatility; normalizing for average session volume.",
      tips: [
        "Divergence between Chaikin Osc and Price is a top-tier signal for hidden institutional accumulation.",
      ],
      pitfalls: ["Signal line crossings alone are weak; focus on zero-line crosses and slopes."],
    },
    output: "line",
    allowMultiple: false,
    overlayOnPrice: false,
    paneIndexRecommendation: 1,
  },
  {
    id: "volumeOsc",
    name: "Volume Oscillator",
    category: "volume",
    description: "Percentage spread between short and long volume EMAs.",
    defaultParams: { short: 14, long: 28 },
    params: [intParam("short", "Short EMA", 2, 200, 1), intParam("long", "Long EMA", 3, 400, 1)],
    usage: {
      whatItDoes:
        "Identifies whether volume participation is expanding or contracting relative to the long-term average. It highlights 'exhaustion' and 'panic' phases.",
      whenToUse:
        "Breakout confirmation (Expanding volume) and peak identification (Parabolic volume exhaustion).",
      formula: "VolOsc = \\frac{EMA(V, short) - EMA(V, long)}{EMA(V, long)} \\times 100",
      mathematicalWeaknesses:
        "Doesn't account for price direction; prone to spikes during single-block liquidations; non-stationary.",
      regimePerformance: "High-Vol: High (expansion detection). Low-Vol: Low.",
      comparisons: "vs. OBV: Volume Osc focuses only on participations strength, not direction.",
      upgrades:
        "Percentage normalization against average session volume; filtering out liquidation spikes.",
      tips: ["Falling volume during a price breakout is a classic signal of a 'fake-out'."],
      pitfalls: ["High volume oscillator values happen in both panic-sells and fomo-buys."],
    },
    output: "line",
    allowMultiple: false,
    overlayOnPrice: false,
    paneIndexRecommendation: 2,
  },
  {
    id: "eom",
    name: "Ease of Movement",
    category: "volume",
    description: "Measures price efficiency relative to traded volume.",
    defaultParams: { period: 14 },
    params: [intParam("period", "Period", 2, 300, 1)],
    usage: {
      whatItDoes:
        "Quantifies the 'effort' required to move price. If price moves easily on low volume, the EOM is high. Useful for detecting low-resistance paths.",
      whenToUse:
        "Detecting the end of high-resistance consolidation and the start of a clean trend.",
      formula:
        "DM = \\frac{H+L}{2} - \\frac{H_p+L_p}{2} \\\\ BR = \\frac{V/10^8}{H-L} \\\\ EOM = SMA\\left( \\frac{DM}{BR}, n \\right)",
      mathematicalWeaknesses:
        "Constant scaling factor ($10^8$) is arbitrary; hyper-sensitive in illiquid coins with high H-L spread and zero volume.",
      regimePerformance: "Trending: High (clean). Ranging: Poor.",
      comparisons:
        "vs. MFI: MFI looks at volume-backed momentum; EOM looks at price-path resistance.",
      upgrades: "Using Mediana-adjusted ATR as the denominator instead of raw Volume.",
      tips: ["High EOM values combined with a trend breakout signal a very high-quality move."],
      pitfalls: [
        "Unreliable in low-liquidity assets where single large orders distort the volume-price relationship.",
      ],
    },
    output: "line",
    allowMultiple: false,
    overlayOnPrice: false,
    paneIndexRecommendation: 2,
  },
  {
    id: "histVol",
    name: "Historical Volatility",
    category: "volatility",
    description: "The annualized standard deviation of log returns.",
    defaultParams: { period: 20, annualization: 365 },
    params: [
      intParam("period", "Period", 5, 500, 1),
      intParam("annualization", "Annualization", 50, 500, 1),
    ],
    usage: {
      whatItDoes:
        "Provides a mathematical measure of price uncertainty by calculating the rolling standard deviation of log-transformed returns. Used extensively in risk-management and options pricing.",
      whenToUse:
        "Dynamic position sizing (Risk Parity), volatility targeting, and identifying 'Volatility Squeezes'.",
      formula:
        "R_t = \\ln\\left( \\frac{C_t}{C_{t-1}} \\right) \\\\ HV = \\text{StdDev}(R, n) \\times \\sqrt{Ann}",
      mathematicalWeaknesses:
        "Backward-looking (lagged); assumes log-normal return distribution (ignoring black swans); sensitive to period choice.",
      regimePerformance: "High-Vol: High. Low-Vol: High (baseline).",
      comparisons:
        "vs. ATR: HV is purely statistical (percentage-based), while ATR is price-based ($). HV is better for cross-asset portfolios.",
      upgrades:
        "GARCH models for volatility forecasting; Parkinson or Garman-Klass volatility estimators.",
      tips: ["Combine with IV (Implied Volatility) to find mispriced trading opportunities."],
      pitfalls: ["Sudden news events cause HV to spike ONLY after the move has already happened."],
    },
    output: "line",
    allowMultiple: false,
    overlayOnPrice: false,
    paneIndexRecommendation: 2,
  },
  {
    id: "aroonOsc",
    name: "Aroon Oscillator",
    category: "cycle",
    description: "Measures trend freshness and cycle shifts.",
    defaultParams: { period: 25 },
    params: [intParam("period", "Period", 5, 300, 1)],
    usage: {
      whatItDoes:
        "Calculates the time elapsed since the highest high and lowest low over N periods. The oscillator (Up minus Down) shows the relative strength of the directional cycle.",
      whenToUse: "Identifying the start of new trends and the exhaustion of old ones.",
      formula:
        "\\text{Up} = 100 \\times \\frac{n - \\text{bars since high}}{n} \\\\ \\text{Down} = 100 \\times \\frac{n - \\text{bars since low}}{n} \\\\ \\text{Osc} = \\text{Up} - \\text{Down}",
      mathematicalWeaknesses:
        "Purely time-based; ignores the magnitude of the price moves; highly reactive near high/low edges.",
      regimePerformance: "New Trends: High (early detection). Ranging: Poor (heavy oscillation).",
      comparisons: "vs. ADX: Aroon identifies trend age and start; ADX identifies trend strength.",
      upgrades: "Adjusting lookback based on dominant cycle analysis.",
      tips: ["A cross above zero after a long period of negativity marks a 'Fresh' bull trend."],
      pitfalls: [
        "In a sideways range, Aroon will flip-flop around zero, generating constant false breakout signals.",
      ],
    },
    output: "line",
    allowMultiple: false,
    overlayOnPrice: false,
    paneIndexRecommendation: 1,
  },
];
