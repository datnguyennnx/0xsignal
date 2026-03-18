import type { IndicatorConfig } from "../types";
import { intParam } from "./params";

export const ADVANCED_INDICATORS: IndicatorConfig[] = [
  {
    id: "stc",
    name: "Schaff Trend Cycle",
    category: "cycle",
    description: "Cycle-adjusted MACD with stochastic smoothing.",
    defaultParams: { fast: 23, slow: 50, cycle: 10, smooth: 3 },
    params: [
      intParam("fast", "Fast EMA", 2, 250, 1),
      intParam("slow", "Slow EMA", 3, 500, 1),
      intParam("cycle", "Cycle Period", 3, 150, 1),
      intParam("smooth", "Smooth", 1, 50, 1),
    ],
    usage: {
      whatItDoes:
        "Combines the trend-following nature of MACD with the cycle-aware nature of Stochastics. It builds a smoother, faster-responding directional oscillator.",
      whenToUse:
        "Detecting early cycle turns and momentum shifts while avoiding the lag of standard MACD signal lines.",
      formula:
        "MACD = EMA_{fast} - EMA_{slow} \\\\ STC = 100 \\times \\text{Stoch}(MACD, cycle, smooth)",
      mathematicalWeaknesses:
        "Extremely heavy dependency on the EMA 'fast/slow' gap; needs significant warm-up data; sensitive to 'cycle' parameter mismatch.",
      regimePerformance: "Trending: High. Cycle Pivot: Excellent. Side-ways: Low (peg risk).",
      comparisons: "vs. MACD: STC is significantly faster and easier to read (0-100 scale).",
      upgrades: "Using Hull MA for the internal MACD components to further reduce lag.",
      tips: ["Bullish entries when STC crosses above 25; bearish when it falls below 75."],
      pitfalls: [
        "Do not ignore the trend direction; STC can flip frequently in a choppy macro environment.",
      ],
    },
    output: "line",
    allowMultiple: false,
    overlayOnPrice: false,
    paneIndexRecommendation: 1,
  },
  {
    id: "dvo",
    name: "David Varadi Oscillator",
    category: "adaptive",
    description: "A rank-based detrended oscillator for mean-reversion.",
    defaultParams: { maPeriod: 2, rankPeriod: 126 },
    params: [
      intParam("maPeriod", "MA Period", 2, 80, 1),
      intParam("rankPeriod", "Rank Period", 10, 500, 1),
    ],
    usage: {
      whatItDoes:
        "Normalizes price relative to a short-term moving average and then applies a cumulative distribution (rank) transform. It's designed to find statistiscal 'stretched' states.",
      whenToUse:
        "High-probability mean-reversion setups and finding local tops/bottoms in equity and crypto markets.",
      formula: "Ratio = \\frac{C}{MA(n)} \\\\ DVO = PercentRank(Ratio, rankPeriod)",
      mathematicalWeaknesses:
        "Rank-based logic makes the current value relative to its own recent history (non-stationary); high computation for large rank periods.",
      regimePerformance: "Ranging: High. Trending: Moderate (caution). Low-Vol: High.",
      comparisons:
        "vs. RSI: DVO is much better at identifying the 'stretched' elastic nature of price relative to its mean.",
      upgrades: "Volatility-weighting the rank window; using a median-based MA (SMA vs EMA).",
      tips: [
        "DVO > 0.9 suggests a massive overextension; DVO < 0.1 suggests an oversold 'rubber-band' state.",
      ],
      pitfalls: [
        "Persistent trends can keep DVO at 1.0 or 0.0 for longer than expected; use with a regime filter.",
      ],
    },
    output: "line",
    allowMultiple: false,
    overlayOnPrice: false,
    paneIndexRecommendation: 1,
  },
  {
    id: "kri",
    name: "Kairi Relative Index",
    category: "momentum",
    description: "Measures percentage deviation from the mean.",
    defaultParams: { period: 14 },
    params: [intParam("period", "Period", 2, 400, 1)],
    usage: {
      whatItDoes:
        "A simple but effective oscillator showing where price is relative to its SMA baseline as a percentage. Effectively a 'distance-from-mean' gauge.",
      whenToUse: "Pullback identification in strong trends and mean-reversion in sideways markets.",
      formula: "KRI = \\frac{C_t - SMA(n)}{SMA(n)} \\times 100",
      mathematicalWeaknesses:
        "Linear deviation doesn't account for volatility expansion; un-bounded scale.",
      regimePerformance: "Trending: High (identifies pullbacks). Ranging: High (mean reversion).",
      comparisons:
        "vs. Bollinger %B: KRI is simpler and doesn't squeeze based on volatility; it's a 'purer' measure of arithmetic stretch.",
      upgrades: "Normalizing KRI by ATR to create a 'Vol-adjusted Kairi'.",
      tips: ["Look for extreme historic KRI levels to time entries into runaway trends."],
      pitfalls: [
        "An asset can remain 'stretched' (High KRI) for a long time during low-liquidity parabolic moves.",
      ],
    },
    output: "line",
    allowMultiple: false,
    overlayOnPrice: false,
    paneIndexRecommendation: 1,
  },
  {
    id: "vzo",
    name: "Volume Zone Oscillator",
    category: "volume",
    description: "Signed-volume momentum gauge for participation analysis.",
    defaultParams: { period: 14 },
    params: [intParam("period", "Period", 2, 300, 1)],
    usage: {
      whatItDoes:
        "Uses EMA to compare the momentum of 'signed' volume (direction of close) against absolute volume flow. Provides a normalized outlook on directional conviction.",
      whenToUse: "Confirming breakouts and detecting distribution when price rises but VZO fails.",
      formula: "VP = \\text{signedVolume} \\\\ VZO = 100 \\times \\frac{EMA(VP, n)}{EMA(|VP|, n)}",
      mathematicalWeaknesses:
        "EMA lag; sensitive to volume spikes; assumes volume direction follows closing price (ignores within-candle behavior).",
      regimePerformance: "Breakout: High. Trending: High. Low-Vol: Moderate.",
      comparisons:
        "vs. OBV: VZO is normalized and easier to integrate into automated signal logic.",
      upgrades: "Combining VZO with ADX to only trade VZO-backed high-strength trends.",
      tips: ["Values > +40 indicate extreme overbought bull-momentum."],
      pitfalls: [
        "Sudden volume clusters (wash-trading or liquidations) can create massive VZO false positives.",
      ],
    },
    output: "line",
    allowMultiple: false,
    overlayOnPrice: false,
    paneIndexRecommendation: 2,
  },
  {
    id: "vortex",
    name: "Vortex Indicator",
    category: "regime",
    description: "Directional trend-locking indicator based on price flow efficiency.",
    defaultParams: { period: 14 },
    params: [intParam("period", "Period", 2, 400, 1)],
    usage: {
      whatItDoes:
        "Identifies the start of a trend and its direction by calculating the distance between the highs and lows of consecutive periods. It creates two lines: +VI and -VI.",
      whenToUse:
        "Confirming trend transitions and defining trend regimes for higher-timeframe swing trading.",
      formula:
        "VM^+ = |H_t - L_{t-1}|, VM^- = |L_t - H_{t-1}| \\\\ TR = \\text{TrueRange} \\\\ VI^+ = \\frac{\\sum VM^+}{\\sum TR}, VI^- = \\frac{\\sum VM^-}{\\sum TR}",
      mathematicalWeaknesses:
        "Significant lag due to long-period summations; prone to whipsaws in tight congestion zones.",
      regimePerformance: "Trending: High. Ranging: Poor (frequent crosses).",
      comparisons:
        "vs. DMI/ADX: Vortex is often considered more 'stable' but slower to react than DMI.",
      upgrades:
        "Using different periods for VI+ and VI- to favor certain directions (Long-bias filters).",
      tips: ["Take trend signals only when the cross coincides with a structural breakout level."],
      pitfalls: [
        "A Vortex cross in a low-volatility side-ways range is almost always an noise-trap.",
      ],
    },
    output: "line",
    allowMultiple: false,
    overlayOnPrice: false,
    paneIndexRecommendation: 1,
  },
];
