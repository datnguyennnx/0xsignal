export type IndicatorCategory = "trend" | "momentum" | "volatility" | "volume" | "oscillators";

export interface IndicatorConfig {
  id: string;
  name: string;
  category: IndicatorCategory;
  description: string;
  defaultParams?: Record<string, number>;
  overlayOnPrice: boolean;
}

export interface ActiveIndicator {
  config: IndicatorConfig;
  params: Record<string, number>;
  visible: boolean;
  color?: string;
}
