import { type ActiveIndicator, type IndicatorConfig } from "@0xsignal/shared";
interface IndicatorSelectorProps {
  activeIndicators: ActiveIndicator[];
  onAddIndicator: (indicator: IndicatorConfig, params?: Record<string, number>) => void;
  onRemoveIndicator: (indicatorId: string) => void;
  onToggleIndicator: (indicatorId: string) => void;
  isOpen: boolean;
  onClose: () => void;
}
export declare function IndicatorSelector({
  activeIndicators,
  onAddIndicator,
  onRemoveIndicator,
  onToggleIndicator,
  isOpen,
  onClose,
}: IndicatorSelectorProps): import("react/jsx-runtime").JSX.Element | null;
export {};
//# sourceMappingURL=indicator-selector.d.ts.map
