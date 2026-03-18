import type { IndicatorConfig } from "../types";
import { intParam } from "./params";

export const VOLUME_INDICATORS: IndicatorConfig[] = [
  {
    id: "vwap",
    name: "Volume Weighted Average Price",
    category: "volume",
    description: "The 'Fair Value' of a session based on price and volume integration.",
    defaultParams: {},
    params: [],
    usage: {
      whatItDoes:
        "Calculates the average price an asset has traded at throughout the day, based on both volume and price. It acts as the anchor for institutional execution.",
      whenToUse:
        "Intraday trend identification, mean-reversion targets, and institutional benchmark tracking.",
      formula: "VWAP = \\frac{\\sum (TypicalPrice \\times Volume)}{\\sum Volume}",
      mathematicalWeaknesses:
        "Cumulative reset (session-based) causes late-day inertia; sensitive to huge volume blocks (HFT/Dark Pools); no predictive power standalone.",
      regimePerformance:
        "High-Vol: High (benchmark accuracy). Trending: High (support/resistance). Low-Vol: Moderate.",
      comparisons:
        "vs. SMA/EMA: VWAP is superior for intraday as it accounts for liquidity distribution, not just time.",
      upgrades:
        "Anchored VWAP (AVWAP) from specific event candles (Earnings/News); VWAP Standard Deviation Bands.",
      tips: [
        "Institutions use VWAP as a 'target' — buying below is value, selling above is premium.",
        "A 'VWAP cross' with volume confirmation is a Tier-1 intraday trend signal.",
      ],
      pitfalls: [
        "Avoid using standard VWAP on non-session anchored data (like 24/7 crypto without proper daily reset).",
      ],
    },
    output: "line",
    allowMultiple: false,
    overlayOnPrice: true,
    paneIndexRecommendation: 0,
  },
  {
    id: "obv",
    name: "On-Balance Volume",
    category: "volume",
    description: "Cumulative volume momentum based on price direction.",
    defaultParams: {},
    params: [],
    usage: {
      whatItDoes:
        "Uses price change direction to attribute volume as either positive (accumulation) or negative (distribution).",
      whenToUse:
        "Confirming trend strength and spotting leading divergence before price breakouts.",
      formula:
        "OBV_t = OBV_{t-1} + \\begin{cases} Vol_t & \\text{if } C_t > C_{t-1} \\\\ 0 & \\text{if } C_t = C_{t-1} \\\\ -Vol_t & \\text{if } C_t < C_{t-1} \\end{cases}",
      mathematicalWeaknesses:
        "Binary attribution (ignores size of price move); highly sensitive to single-period outliers; cumulative nature makes old data heavy.",
      regimePerformance: "Trending: High. Ranging: Moderate (shows building pressure).",
      comparisons:
        "vs. PVT: PVT is superior as it scales volume by the percentage of price move, reducing outlier noise.",
      upgrades: "Smoothing OBV with a 21-period EMA; Normalized OBV.",
      tips: ["If OBV hits a new high but price does not, a breakout is likely imminent."],
      pitfalls: [
        "Volume spikes during news events (gaps) can permanently disconnect the OBV baseline.",
      ],
    },
    output: "line",
    allowMultiple: false,
    overlayOnPrice: false,
    paneIndexRecommendation: 2,
  },
  {
    id: "pvt",
    name: "Price Volume Trend",
    category: "volume",
    description: "Percentage-scaled cumulative volume accumulation.",
    defaultParams: {},
    params: [],
    usage: {
      whatItDoes:
        "Similar to OBV, but it weights every volume bar by the relative price change percentage.",
      whenToUse: "Detecting money-flow strength with less noise than OBV.",
      formula:
        "PVT_t = PVT_{t-1} + \\left( Vol_t \\times \\frac{\\text{Close}_t - \\text{Close}_{t-1}}{\\text{Close}_{t-1}} \\right)",
      mathematicalWeaknesses:
        "Cumulative drift; becomes unstable if price approaches zero (low-cap tokens).",
      regimePerformance: "Trending: High. High-Vol: Excellent.",
      comparisons: "vs. OBV: PVT is 'smarter' as it respects the magnitude of the move.",
      upgrades: "EMA of PVT for signal crossing; volatility-adjusted volume input.",
      tips: ["Look for PVT to break trendlines before price does."],
      pitfalls: ["Can be distorted by massive percentage gains in illiquid junk-coins."],
    },
    output: "line",
    allowMultiple: false,
    overlayOnPrice: false,
    paneIndexRecommendation: 2,
  },
  {
    id: "nvi",
    name: "Negative Volume Index",
    category: "volume",
    description: "Tracks smart-money movement during low-participation sessions.",
    defaultParams: {},
    params: [],
    usage: {
      whatItDoes:
        "Identifies days where volume decreases, assuming that professional money is most active during quiet periods while 'crowd' money drives high-volume spikes.",
      whenToUse: "Long-term bullish trend confirmation and identifying accumulation phases.",
      formula:
        "\\text{If } V_t < V_{t-1}: NVI_t = NVI_{t-1} + \\frac{C_t - C_{t-1}}{C_{t-1}} \\text{ else } NVI_t = NVI_{t-1}",
      mathematicalWeaknesses:
        "Extremely passive; can stay flat for very long periods; scale is arbitrary.",
      regimePerformance:
        "Bullish: High (smart money accumulation). Bearish: Moderate. Low-Vol: Excellent.",
      comparisons:
        "vs. PVI (Positive Volume Index): NVI is generally considered more predictive of smart money behavior.",
      upgrades: "255-period EMA crossover (Norman Fosback rule).",
      tips: ["A bull market is confirmed when NVI is above its 255-day EMA."],
      pitfalls: ["Not suitable for fast intraday trading or mean-reversion."],
    },
    output: "line",
    allowMultiple: false,
    overlayOnPrice: false,
    paneIndexRecommendation: 2,
  },
  {
    id: "mfi",
    name: "Money Flow Index",
    category: "moneyflow",
    description: "Volume-weighted RSI for detecting buying/selling pressure.",
    defaultParams: { period: 14 },
    params: [intParam("period", "Period", 1, 300, 1)],
    usage: {
      whatItDoes:
        "Combines Price action and Volume to create an oscillator that measures 'strength' of money flow into and out of an asset.",
      whenToUse: "Identifying 'Volume-backed' overbought/oversold states and momentum exhaustion.",
      formula:
        "TP = \\frac{H+L+C}{3} \\\\ MF = TP \\times V \\\\ MFR = \\frac{\\text{Positive MF}_n}{\\text{Negative MF}_n} \\\\ MFI = 100 - \\frac{100}{1+MFR}",
      mathematicalWeaknesses:
        "Uses 'Typical Price' (HLC/3) which can mask closing strength; fixed boundaries (0-100) risk pegging.",
      regimePerformance:
        "Ranging: High. Trending: Moderate. High-Vol: High (captures 'Blow-off' tops).",
      comparisons:
        "vs. RSI: MFI is much more 'honest' as it ignores high-price moves on thin volume.",
      upgrades: "Adaptive period based on VIX/Vol; Log-volume scaling.",
      tips: ["Watch for the 80/20 zones. Failure to reach 80 during a rally is a major warning."],
      pitfalls: ["Can stay overheated in strong institutional accumulation trends."],
    },
    output: "line",
    allowMultiple: false,
    overlayOnPrice: false,
    paneIndexRecommendation: 1,
  },
  {
    id: "cmf",
    name: "Chaikin Money Flow",
    category: "moneyflow",
    description: "Measures institutional accumulation/distribution pressure.",
    defaultParams: { period: 20 },
    params: [intParam("period", "Period", 1, 400, 1)],
    usage: {
      whatItDoes:
        "Calculates the sum of Money Flow Volume over a period divided by the sum of Volume, providing a normalized oscillator between -1 and 1.",
      whenToUse: "Confirming trend sustainability and institutional participation.",
      formula: "CMF = \\frac{\\sum_{i=1}^n MoneyFlowVolume_i}{\\sum_{i=1}^n Volume_i}",
      mathematicalWeaknesses:
        "Money flow multiplier uses (C-L)-(H-C), which is sensitive to wicks; 20-period default is often too reactive for macro trends.",
      regimePerformance: "Trending: High (confirmation). Ranging: Low (noise).",
      comparisons:
        "vs. OBV: CMF is normalized, making it better for cross-asset scans. vs. MFI: CMF is better at spotting sustained distribution.",
      upgrades: "Double smoothing for signal clarity; Volatility-normalization of the multiplier.",
      tips: ["Sustained values > +0.20 indicate massive institutional accumulation."],
      pitfalls: [
        "Abrupt volume spikes from liquidations can flip the signal temporarily and cause false positives.",
      ],
    },
    output: "line",
    allowMultiple: false,
    overlayOnPrice: false,
    paneIndexRecommendation: 1,
  },
  {
    id: "adLine",
    name: "Accumulation/Distribution Line",
    category: "moneyflow",
    description: "Tracks the cumulative relationship between price and volume flow.",
    defaultParams: {},
    params: [],
    usage: {
      whatItDoes:
        "Uses the Close's proximity to High/Low to determine if volume is accumulating or distributing at current levels.",
      whenToUse: "Identifying divergence against price trend and structural supply/demand shifts.",
      formula:
        "MFM = \\frac{(C-L) - (H-C)}{H-L} \\\\ MFV = MFM \\times V \\\\ ADL_t = ADL_{t-1} + MFV_t",
      mathematicalWeaknesses:
        "Zero high-low range (limit moves) causes division by zero; extreme sensitivity to wick-heavy assets (common in Alts).",
      regimePerformance: "Trending: High (leading indicator). Ranging: High.",
      comparisons:
        "vs. OBV: ADL is more granular as it looks at internal candle structure, not just close-to-close.",
      upgrades: "Chaikin Oscillator (EMA spread of ADL).",
      tips: [
        "Rising ADL during a price dip is the most powerful 'Hidden Bullish' signal in quant-tech.",
      ],
      pitfalls: ["Large gaps or 'wicky' assets can cause permanent skew in the cumulative line."],
    },
    output: "line",
    allowMultiple: false,
    overlayOnPrice: false,
    paneIndexRecommendation: 2,
  },
];
