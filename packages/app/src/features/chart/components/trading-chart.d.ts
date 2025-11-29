import type { ChartDataPoint } from "@0xsignal/shared";
interface TradingChartProps {
  data: ChartDataPoint[];
  symbol: string;
  interval: string;
  onIntervalChange: (interval: string) => void;
}
export declare function TradingChart({
  data,
  symbol,
  interval,
  onIntervalChange,
}: TradingChartProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=trading-chart.d.ts.map
