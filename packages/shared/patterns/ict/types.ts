import { ICT_TYPES, DIRECTION, DETECTION_THRESHOLDS } from "../constants";

export type SwingType = (typeof ICT_TYPES.SWING)[keyof typeof ICT_TYPES.SWING];
export type TrendDirection = (typeof DIRECTION)[keyof typeof DIRECTION];
export type StructureBreak = (typeof ICT_TYPES.STRUCTURE)[keyof typeof ICT_TYPES.STRUCTURE];
export type FVGType = (typeof DIRECTION)[keyof typeof DIRECTION];
export type OrderBlockType = (typeof DIRECTION)[keyof typeof DIRECTION];
export type LiquidityType = (typeof ICT_TYPES.LIQUIDITY)[keyof typeof ICT_TYPES.LIQUIDITY];

export interface SwingPoint {
  readonly time: number;
  readonly price: number;
  readonly type: SwingType;
  readonly index: number;
}

export interface StructureEvent {
  readonly time: number;
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

export interface FairValueGap {
  readonly startTime: number;
  readonly endTime: number;
  readonly type: FVGType;
  readonly high: number;
  readonly low: number;
  readonly midpoint: number;
  readonly filled: boolean;
  readonly fillPercent: number;
  readonly index: number;
}

export interface OrderBlock {
  readonly time: number;
  readonly type: OrderBlockType;
  readonly high: number;
  readonly low: number;
  readonly mitigated: boolean;
  readonly mitigatedAt?: number;
  readonly index: number;
}

export interface LiquidityZone {
  readonly type: LiquidityType;
  readonly price: number;
  readonly startTime: number;
  readonly endTime: number;
  readonly swept: boolean;
  readonly sweepTime?: number;
  readonly touchCount: number;
}

export interface OTEZone {
  readonly startTime: number;
  readonly endTime: number;
  readonly direction: TrendDirection;
  readonly fibLevels: Record<string, number>;
  readonly goldenPocketHigh: number;
  readonly goldenPocketLow: number;
}

export interface ICTAnalysis {
  readonly marketStructure: MarketStructure;
  readonly fvgs: FairValueGap[];
  readonly orderBlocks: OrderBlock[];
  readonly liquidityZones: LiquidityZone[];
  readonly oteZones: OTEZone[];
}

export interface ICTConfig {
  swingLookback: number;
  fvgMinSize: number;
  obLookback: number;
  liquidityTolerance: number;
  atrPeriod: number;
}

export const DEFAULT_ICT_CONFIG: ICTConfig = {
  swingLookback: 3,
  fvgMinSize: DETECTION_THRESHOLDS.FVG_MIN_SIZE_PERCENT,
  obLookback: 10,
  liquidityTolerance: DETECTION_THRESHOLDS.LIQUIDITY_TOUCH_TOLERANCE,
  atrPeriod: 14,
};
