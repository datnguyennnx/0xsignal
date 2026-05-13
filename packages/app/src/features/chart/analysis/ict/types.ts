/**
 * @overview Inner Circle Trader (ICT) Analysis Shared Types
 */
import type { Time } from "lightweight-charts";
import type { AnalysisFeature } from "../shared";

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

// Shared UI config for AnalysisButton
export const ICT_LABEL = "ICT";

export const ICT_FEATURES: readonly AnalysisFeature[] = [
  {
    id: "marketStructure",
    label: "Market Structure",
    description: "HH/HL/LH/LL swings, BOS & ChoCH",
    color: "bg-foreground/80",
  },
  {
    id: "fvg",
    label: "Fair Value Gaps",
    description: "Imbalance zones",
    color: "bg-foreground/50",
  },
  {
    id: "orderBlocks",
    label: "Order Blocks",
    description: "Supply/demand zones",
    color: "bg-foreground/30",
  },
  {
    id: "liquidity",
    label: "Liquidity Zones",
    description: "BSL/SSL clusters",
    color: "bg-foreground/60",
  },
  {
    id: "ote",
    label: "OTE Zones",
    description: "61.8%-78.6% Fibonacci",
    color: "bg-foreground/40",
  },
  {
    id: "displacement",
    label: "Displacement",
    description: "Strong momentum candles",
    color: "bg-foreground/20",
  },
];

export const ICT_FOOTER = {
  text: "Best on 15m, 1H, 4H timeframes",
  subtext: "ICT by Michael J. Huddleston",
} as const;
