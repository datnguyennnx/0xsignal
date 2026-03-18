import type { IndicatorConfig } from "../types";
import { intParam, floatParam } from "./params";

export const VOLATILITY_INDICATORS: IndicatorConfig[] = [
  {
    id: "bollingerBands",
    name: "Bollinger Bands",
    category: "volatility",
    description: "Volatility envelopes based on SMA +/- Standard Deviation.",
    defaultParams: { period: 20, stdDev: 2 },
    params: [intParam("period", "Period", 1, 500, 1), floatParam("stdDev", "Std Dev", 0.5, 6, 0.1)],
    usage: {
      whatItDoes:
        "Uses standard deviation as a proxy for volatility to create dynamic support/resistance zones around a central SMA.",
      whenToUse:
        "Detecting the 'Bollinger Squeeze' (low vol) and expansions (high vol), mean-reversion targets, and trend continuation.",
      formula:
        "\\text{Base} = SMA(n) \\\\ \\text{Upper} = \\text{Base} + (k \\times \\sigma) \\\\ \\text{Lower} = \\text{Base} - (k \\times \\sigma)",
      mathematicalWeaknesses:
        "Assumes Gaussian distribution of returns (false in fat-tail crypto markets); SMA lag; sensitivity to outlier candles in small periods.",
      regimePerformance:
        "Ranging: High (mean-reversion). Trending: Moderate (walking the bands). Low Vol: Excellent (squeeze detection).",
      comparisons:
        "vs. Keltner Channels: Bollinger uses StdDev (reactive), Keltner uses ATR (stable). Bollinger bands 'balloon' faster.",
      upgrades:
        "Double Bollinger Bands (Elder); Volatility-adjusted lookback; using HMA or EMA for the central baseline.",
      tips: [
        "A squeeze (bands tightening) is the precursor to a high-volatility breakout.",
        "Middle band (SMA 20) often acts as the primary support in a healthy trend.",
      ],
      pitfalls: [
        "Touching the band is NOT a signal; price can 'walk' the band for weeks in a bubble.",
      ],
    },
    output: "band",
    allowMultiple: false,
    overlayOnPrice: true,
    paneIndexRecommendation: 0,
    implementationNotesForDev: "Requires Rolling StdDev. Overlay on Price pane is mandatory.",
  },
  {
    id: "keltnerChannels",
    name: "Keltner Channels",
    category: "volatility",
    description: "ATR-based volatility envelopes around an EMA baseline.",
    defaultParams: { period: 20, multiplier: 2 },
    params: [
      intParam("period", "Period", 1, 500, 1),
      floatParam("multiplier", "ATR Multiplier", 0.5, 10, 0.1),
    ],
    usage: {
      whatItDoes:
        "Combines EMA trend direction with ATR volatility range to frame price action and identify trend exhaustion.",
      whenToUse:
        "Following trend breakouts and filtering out noise in high-volatility environments.",
      formula:
        "\\text{Base} = EMA(n) \\\\ \\text{Upper} = \\text{Base} + (m \\times ATR) \\\\ \\text{Lower} = \\text{Base} - (m \\times ATR)",
      mathematicalWeaknesses:
        "Linear scaling with ATR can underperform in exponential blow-off tops; EMA lag.",
      regimePerformance:
        "Trending: High (stays wide). Ranging: Moderate. High Vol: Excellent (more robust than Bollinger).",
      comparisons:
        "vs. Bollinger: Keltner is smoother and 'grows' more linearly. It's preferred by many trend-followers for stop-loss logic.",
      upgrades:
        "Using Multiple multipliers (1x, 2x, 3x) to define 'Vol-Zones'; Adaptive ATR periods.",
      tips: [
        "Prices closing outside the 2x ATR band signal a strong breakout regime.",
        "Use the 1x band for trailing stops in aggressive trends.",
      ],
      pitfalls: ["May stick to a sideways range too tightly if ATR period is too short."],
    },
    output: "band",
    allowMultiple: false,
    overlayOnPrice: true,
    paneIndexRecommendation: 0,
  },
  {
    id: "donchianChannels",
    name: "Donchian Channels",
    category: "volatility",
    description: "Price boundaries defined by rolling Highs and Lows.",
    defaultParams: { period: 20 },
    params: [intParam("period", "Period", 1, 500, 1)],
    usage: {
      whatItDoes:
        "Shows the highest high and lowest low of the last N periods. Classic tool for Turtle-style breakout trading.",
      whenToUse:
        "Trend-following breakout entries, trailing stops, and range-boundary identification.",
      formula:
        "\\text{Upper} = \\max(H, n) \\\\ \\text{Lower} = \\min(L, n) \\\\ \\text{Mid} = (U + L) / 2",
      mathematicalWeaknesses:
        "No smoothing — purely price-dependent; 'echo' effect on old highs; can stay flat for long periods.",
      regimePerformance: "Trending: High (breakout trigger). Ranging: Low (whipsaw city).",
      comparisons:
        "vs. Price Action: It IS price action summarized. vs. Bollinger: Donchian is definitive (absolute price), Bollinger is statistical.",
      upgrades: "Offset Donchian for signal clarity; Period-adaptive sizing.",
      tips: ["The 10-period Low is a classic 'exit' for a 20-period High breakout trade."],
      pitfalls: ["Highly prone to 'Turtle Soup' (false breakouts) in sideways market structure."],
    },
    output: "band",
    allowMultiple: false,
    overlayOnPrice: true,
    paneIndexRecommendation: 0,
  },
  {
    id: "atr",
    name: "Average True Range",
    category: "volatility",
    description: "Standard measure of absolute price volatility.",
    defaultParams: { period: 14 },
    params: [intParam("period", "Period", 1, 300, 1)],
    usage: {
      whatItDoes:
        "Averages the True Range (Max of HL, H-Cp, Cp-L) to quantify market participation intensity and risk.",
      whenToUse: "Position sizing (Volatility-adjusting), trailing stops, and breakout validation.",
      formula: "TR = \\max(H-L, |H-C_p|, |L-C_p|) \\\\ ATR = EMA(TR, n)",
      mathematicalWeaknesses:
        "Lacks normalization (hard to compare $100 stock vs $50k BTC); purely directional-agnostic; reactive lag.",
      regimePerformance: "High-Vol: High (expansion). Low-Vol: Low (compression).",
      comparisons:
        "vs. StdDev: ATR focus on ranges (more 'real' for traders), StdDev focus on closes (statistical).",
      upgrades: "ATRP (normalized %); NATR (Normalized ATR).",
      tips: [
        "A 2x ATR stop is a robust baseline for many trend-following strategies.",
        "ATR expansion often marks the 'Panic' phase of a move.",
      ],
      pitfalls: [
        "Do not use ATR to predict price direction; high ATR happens in both crashes and moon-shots.",
      ],
    },
    output: "line",
    allowMultiple: false,
    overlayOnPrice: false,
    paneIndexRecommendation: 2,
  },
];
