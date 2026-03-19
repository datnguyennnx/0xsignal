// Centralized constants for pattern detection
// These can be easily modified to adjust detection sensitivity

export const DIRECTION = {
  BULLISH: "bullish" as const,
  BEARISH: "bearish" as const,
  NEUTRAL: "neutral" as const,
} as const;

export type Direction = (typeof DIRECTION)[keyof typeof DIRECTION];

// ICT Specific
export const ICT_TYPES = {
  SWING: {
    HH: "HH",
    HL: "HL",
    LH: "LH",
    LL: "LL",
  } as const,
  STRUCTURE: {
    BOS: "BOS",
    CHOCH: "ChoCH",
  } as const,
  LIQUIDITY: {
    BSL: "BSL",
    SSL: "SSL",
  } as const,
} as const;

// Wyckoff Specific
export const WYCKOFF_TYPES = {
  PHASE: {
    A: "A",
    B: "B",
    C: "C",
    D: "D",
    E: "E",
  } as const,
  CYCLE: {
    ACCUMULATION: "accumulation",
    DISTRIBUTION: "distribution",
    MARKUP: "markup",
    MARKDOWN: "markdown",
    UNKNOWN: "unknown",
  } as const,
  CLIMAX: {
    SC: "SC",
    BC: "BC",
  } as const,
  EVENT: {
    SPRING: "spring",
    UPTHRUST: "upthrust",
    ST: "ST",
    LPS: "LPS",
    LPSY: "LPSY",
    SOS: "SOS",
    SOW: "SOW",
  } as const,
  DIVERGENCE: {
    BULLISH: "bullish",
    BEARISH: "bearish",
    NEUTRAL: "neutral",
  } as const,
} as const;

// Detection thresholds
export const DETECTION_THRESHOLDS = {
  FVG_MIN_SIZE_PERCENT: 0.05,
  ORDER_BLOCK_ATR_MULTIPLIER: 1.5,
  LIQUIDITY_TOUCH_TOLERANCE: 0.15,
  VOLUME_CLIMAX_MULTIPLIER: 1.5,
  SPREAD_CLIMAX_MULTIPLIER: 1.2,
  SPRING_VOL_THRESHOLD: 0.5,
  EFFORT_LOOKBACK: 5,
} as const;

// Fibonacci levels for OTE
export const FIB_LEVELS = {
  "0": 0,
  "0.236": 0.236,
  "0.382": 0.382,
  "0.5": 0.5,
  "0.618": 0.618,
  "0.786": 0.786,
  "1": 1,
} as const;

export const GOLDEN_POCKET = {
  HIGH: "0.618" as const,
  LOW: "0.786" as const,
} as const;

// Signal types for trading signals
export const SIGNAL_TYPE = {
  LONG: "long" as const,
  SHORT: "short" as const,
  NONE: "none" as const,
} as const;

export type SignalType = (typeof SIGNAL_TYPE)[keyof typeof SIGNAL_TYPE];

// Signal confidence levels
export const CONFIDENCE = {
  HIGH: 85,
  MEDIUM: 70,
} as const;

export type ConfidenceLevel = (typeof CONFIDENCE)[keyof typeof CONFIDENCE];

// Signal significance levels
export const SIGNIFICANCE = {
  HIGH: "high" as const,
  MEDIUM: "medium" as const,
} as const;

export type SignificanceLevel = (typeof SIGNIFICANCE)[keyof typeof SIGNIFICANCE];

// Swing types for market structure
export const SWING_TYPE = {
  HIGH: "high" as const,
  LOW: "low" as const,
} as const;

export type SwingTypeLevel = (typeof SWING_TYPE)[keyof typeof SWING_TYPE];

// Trade parameters for stop loss and take profit
export const TRADE_PARAMS = {
  STOP_LOSS_PERCENT: 0.02,
  TAKE_PROFIT_MULTIPLIER_LOW: 1.5,
  TAKE_PROFIT_MULTIPLIER_HIGH: 2,
  STOP_LOSS_MULTIPLIER: 0.5,
  TAKE_PROFIT_MULTIPLIER: 2,
} as const;

// Volume significance thresholds
export const VOLUME_THRESHOLDS = {
  VERY_LOW: 0.3,
  LOW: 0.5,
  MEDIUM: 0.7,
  HIGH: 0.8,
  VERY_HIGH: 1.2,
  EXTREME: 1.5,
} as const;

// Effort/Result divergence thresholds
export const DIVERGENCE_THRESHOLDS = {
  EFFORT_HIGH: 1.5,
  EFFORT_LOW: 0.5,
  RESULT_LOW: 0.5,
  RESULT_HIGH: 1.5,
  STRONG_EFFORT: 2.0,
  STRONG_RESULT: 0.3,
  STRONG_REVERSE_EFFORT: 0.3,
  STRONG_REVERSE_RESULT: 2.0,
} as const;

// Cycle detection thresholds
export const CYCLE_THRESHOLDS = {
  PRICE_CHANGE_PERCENT: 0.05,
  MIN_RANGE_LENGTH: 5,
  ATR_TOLERANCE: 0.3,
} as const;

// Cycle phase types
export const CYCLE_PHASE = {
  ACCUMULATION: "accumulation" as const,
  DISTRIBUTION: "distribution" as const,
  TRANSITION: "transition" as const,
} as const;

export type CyclePhaseType = (typeof CYCLE_PHASE)[keyof typeof CYCLE_PHASE];

// Cycle direction types
export const CYCLE_DIRECTION = {
  UP: "up" as const,
  DOWN: "down" as const,
  SIDEWAYS: "sideways" as const,
} as const;

export type CycleDirectionType = (typeof CYCLE_DIRECTION)[keyof typeof CYCLE_DIRECTION];

// Indicator output types
export const INDICATOR_OUTPUT = {
  BAND: "band" as const,
  HISTOGRAM: "histogram" as const,
  LINE: "line" as const,
} as const;

// Indicator type IDs for dispatcher
export const INDICATOR_TYPE = {
  // Trend indicators
  SMA: "sma",
  EMA: "ema",
  WMA: "wma",
  HMA: "hma",
  VWMA: "vwma",
  VWAP: "vwap",
  SUPER_TREND: "superTrend",
  PARABOLIC_SAR: "parabolicSAR",
  ADX: "adx",

  // Momentum indicators
  RSI: "rsi",
  MACD: "macd",
  STOCHASTIC: "stochastic",
  AO: "ao",
  UO: "uo",
  WILLIAMS_R: "williamsR",
  CCI: "cci",
  ROC: "roc",
  MOMENTUM: "momentum",
  TSI: "tsi",
  ZSCORE: "zscore",
  STDDEV: "stddev",
  LIN_REG_SLOPE: "linRegSlope",
  ATRP: "atrp",
  CHOP: "chop",
  EFFICIENCY_RATIO: "efficiencyRatio",
  STC: "stc",
  DVO: "dvo",
  KRI: "kri",
  VZO: "vzo",
  VORTEX: "vortex",
  PPO: "ppo",
  TRIX: "trix",
  STOCH_RSI: "stochRsi",
  VOLUME_OSC: "volumeOsc",
  CHAIKIN_OSC: "chaikinOsc",
  EOM: "eom",
  HIST_VOL: "histVol",
  AROON_OSC: "aroonOsc",

  // Volatility indicators
  ATR: "atr",

  // Volume indicators
  OBV: "obv",
  MFI: "mfi",
  PVT: "pvt",
  NVI: "nvi",
  CMF: "cmf",
  AD_LINE: "adLine",

  // Band indicators
  BOLLINGER_BANDS: "bollingerBands",
  KELTNER_CHANNELS: "keltnerChannels",
  DONCHIAN_CHANNELS: "donchianChannels",
} as const;
