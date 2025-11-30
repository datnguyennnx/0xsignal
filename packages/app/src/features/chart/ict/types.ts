// ICT (Inner Circle Trader) Type Definitions
// Pure data structures for ICT concepts

import type { Time } from "lightweight-charts";

// ===== SWING & MARKET STRUCTURE =====

export type SwingType = "HH" | "HL" | "LH" | "LL";
export type TrendDirection = "bullish" | "bearish" | "neutral";
export type StructureBreak = "BOS" | "ChoCH";

export interface SwingPoint {
  readonly time: Time;
  readonly price: number;
  readonly type: SwingType;
  readonly index: number;
}

export interface StructureEvent {
  readonly time: Time;
  readonly price: number;
  readonly type: StructureBreak;
  readonly direction: TrendDirection;
  readonly index: number;
}

export interface MarketStructure {
  readonly swings: SwingPoint[];
  readonly events: StructureEvent[];
  readonly currentTrend: TrendDirection;
}

// ===== FAIR VALUE GAP (FVG) =====

export type FVGType = "bullish" | "bearish";

export interface FairValueGap {
  readonly startTime: Time;
  readonly endTime: Time;
  readonly type: FVGType;
  readonly high: number; // Upper boundary
  readonly low: number; // Lower boundary
  readonly midpoint: number;
  readonly filled: boolean;
  readonly fillPercent: number;
  readonly index: number;
}

// ===== ORDER BLOCK (OB) =====

export type OrderBlockType = "bullish" | "bearish";

export interface OrderBlock {
  readonly time: Time;
  readonly type: OrderBlockType;
  readonly high: number;
  readonly low: number;
  readonly mitigated: boolean;
  readonly index: number;
}

// ===== LIQUIDITY ZONES =====

export type LiquidityType = "BSL" | "SSL"; // Buy-Side / Sell-Side Liquidity

export interface LiquidityZone {
  readonly type: LiquidityType;
  readonly price: number;
  readonly startTime: Time;
  readonly endTime: Time;
  readonly swept: boolean;
  readonly sweepTime?: Time;
  readonly touchCount: number;
}

// ===== OPTIMAL TRADE ENTRY (OTE) =====

export interface OTEZone {
  readonly startTime: Time;
  readonly endTime: Time;
  readonly direction: TrendDirection;
  readonly fibLevels: {
    readonly "0": number;
    readonly "0.236": number;
    readonly "0.382": number;
    readonly "0.5": number;
    readonly "0.618": number;
    readonly "0.786": number;
    readonly "1": number;
  };
  readonly goldenPocketHigh: number; // 0.618
  readonly goldenPocketLow: number; // 0.786
}

// ===== DISPLACEMENT =====

export interface Displacement {
  readonly time: Time;
  readonly direction: TrendDirection;
  readonly magnitude: number; // ATR multiple
  readonly index: number;
}

// ===== ICT ANALYSIS RESULT =====

export interface ICTAnalysis {
  readonly marketStructure: MarketStructure;
  readonly fvgs: FairValueGap[];
  readonly orderBlocks: OrderBlock[];
  readonly liquidityZones: LiquidityZone[];
  readonly oteZones: OTEZone[];
  readonly displacements: Displacement[];
}

// ===== ICT CONFIG =====

export interface ICTConfig {
  readonly showMarketStructure: boolean;
  readonly showFVG: boolean;
  readonly showOrderBlocks: boolean;
  readonly showLiquidity: boolean;
  readonly showOTE: boolean;
  readonly showDisplacement: boolean;
  // Detection parameters
  readonly swingThreshold: number; // Percentage for swing detection
  readonly fvgMinSize: number; // Minimum FVG size as % of price
  readonly obLookback: number; // Candles to look back for OB
  readonly liquidityTolerance: number; // % tolerance for equal highs/lows
  readonly displacementMultiple: number; // ATR multiple for displacement
}

export const DEFAULT_ICT_CONFIG: ICTConfig = {
  showMarketStructure: true,
  showFVG: true,
  showOrderBlocks: true,
  showLiquidity: false,
  showOTE: false,
  showDisplacement: false,
  swingThreshold: 0.5,
  fvgMinSize: 0.1,
  obLookback: 10,
  liquidityTolerance: 0.1,
  displacementMultiple: 1.5,
};

// ===== ICT VISIBILITY STATE =====

export type ICTFeature =
  | "marketStructure"
  | "fvg"
  | "orderBlocks"
  | "liquidity"
  | "ote"
  | "displacement";

export interface ICTVisibility {
  readonly marketStructure: boolean;
  readonly fvg: boolean;
  readonly orderBlocks: boolean;
  readonly liquidity: boolean;
  readonly ote: boolean;
  readonly displacement: boolean;
}

// Default: All features OFF - user must explicitly enable
export const DEFAULT_ICT_VISIBILITY: ICTVisibility = {
  marketStructure: false,
  fvg: false,
  orderBlocks: false,
  liquidity: false,
  ote: false,
  displacement: false,
};
