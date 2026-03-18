// Centralized constants for pattern detection
// These can be easily modified to adjust detection sensitivity

export const DIRECTION = {
  BULLISH: "bullish" as const,
  BEARISH: "bearish" as const,
  NEUTRAL: "neutral" as const,
} as const;

export type Direction = (typeof DIRECTION)[keyof typeof DIRECTION];

export const MARKET_DIRECTION = {
  BULLISH: "bullish" as const,
  BEARISH: "bearish" as const,
  NEUTRAL: "neutral" as const,
} as const;

export type MarketDirection = (typeof MARKET_DIRECTION)[keyof typeof MARKET_DIRECTION];

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

// Signal confidence levels
export const CONFIDENCE = {
  HIGH: 85,
  MEDIUM: 70,
  LOW: 50,
} as const;
