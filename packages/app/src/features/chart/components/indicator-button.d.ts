import type { ActiveIndicator, IndicatorConfig } from "@0xsignal/shared";
interface IndicatorButtonProps {
  activeIndicators: ActiveIndicator[];
  onAddIndicator: (indicator: IndicatorConfig, params?: Record<string, number>) => void;
  onRemoveIndicator: (indicatorId: string) => void;
  onToggleIndicator: (indicatorId: string) => void;
  className?: string;
}
export declare const IndicatorButton: import("react").NamedExoticComponent<IndicatorButtonProps>;
export {};
//# sourceMappingURL=indicator-button.d.ts.map
