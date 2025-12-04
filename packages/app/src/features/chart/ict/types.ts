import type { Time } from "lightweight-charts";

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

export type FVGType = "bullish" | "bearish";

export interface FairValueGap {
  readonly startTime: Time;
  readonly endTime: Time;
  readonly type: FVGType;
  readonly high: number;
  readonly low: number;
  readonly midpoint: number;
  readonly filled: boolean;
  readonly fillPercent: number;
  readonly index: number;
}

export type OrderBlockType = "bullish" | "bearish";

export interface OrderBlock {
  readonly time: Time;
  readonly type: OrderBlockType;
  readonly high: number;
  readonly low: number;
  readonly mitigated: boolean;
  readonly index: number;
}

export type LiquidityType = "BSL" | "SSL";

export interface LiquidityZone {
  readonly type: LiquidityType;
  readonly price: number;
  readonly startTime: Time;
  readonly endTime: Time;
  readonly swept: boolean;
  readonly sweepTime?: Time;
  readonly touchCount: number;
}

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
  readonly goldenPocketHigh: number;
  readonly goldenPocketLow: number;
}

export interface Displacement {
  readonly time: Time;
  readonly direction: TrendDirection;
  readonly magnitude: number;
  readonly index: number;
}

export interface ICTAnalysis {
  readonly marketStructure: MarketStructure;
  readonly fvgs: FairValueGap[];
  readonly orderBlocks: OrderBlock[];
  readonly liquidityZones: LiquidityZone[];
  readonly oteZones: OTEZone[];
  readonly displacements: Displacement[];
}

export interface ICTConfig {
  readonly showMarketStructure: boolean;
  readonly showFVG: boolean;
  readonly showOrderBlocks: boolean;
  readonly showLiquidity: boolean;
  readonly showOTE: boolean;
  readonly showDisplacement: boolean;
  readonly swingThreshold: number;
  readonly fvgMinSize: number;
  readonly obLookback: number;
  readonly liquidityTolerance: number;
  readonly displacementMultiple: number;
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

export const DEFAULT_ICT_VISIBILITY: ICTVisibility = {
  marketStructure: false,
  fvg: false,
  orderBlocks: false,
  liquidity: false,
  ote: false,
  displacement: false,
};
