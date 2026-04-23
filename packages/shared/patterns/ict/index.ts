import type { ChartDataPoint } from "../../types/chart";
import type {
  ICTAnalysis,
  ICTConfig,
  SwingPoint,
  StructureEvent,
  MarketStructure,
  FairValueGap,
  OrderBlock,
  LiquidityZone,
  OTEZone,
  SwingType,
  TrendDirection,
  StructureBreak,
  FVGType,
  OrderBlockType,
  LiquidityType,
} from "./types";
import { DEFAULT_ICT_CONFIG } from "./types";
import { analyzeICT as runICTAnalysis } from "./utils";

export { DEFAULT_ICT_CONFIG };
export type {
  ICTAnalysis,
  ICTConfig,
  SwingPoint,
  StructureEvent,
  MarketStructure,
  FairValueGap,
  OrderBlock,
  LiquidityZone,
  OTEZone,
  SwingType,
  TrendDirection,
  StructureBreak,
  FVGType,
  OrderBlockType,
  LiquidityType,
};
export const analyzeICT = (data: ChartDataPoint[], config: ICTConfig): ICTAnalysis => {
  return runICTAnalysis(data, config);
};
