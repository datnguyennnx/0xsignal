import type { ActiveIndicator, IndicatorConfig } from "@0xsignal/shared";
import { IndicatorConfigPanel } from "./config-panel";
import { IndicatorInsightsPanel } from "./insights-panel";

interface IndicatorModalDetailProps {
  indicator: IndicatorConfig;
  activeIndicators: ActiveIndicator[];
  onAddIndicator: (indicator: IndicatorConfig, params?: Record<string, number>) => void;
  onRemoveIndicator: (indicatorId: string) => void;
}

export function IndicatorModalDetail({
  indicator,
  activeIndicators,
  onAddIndicator,
  onRemoveIndicator,
}: IndicatorModalDetailProps) {
  return (
    <>
      <IndicatorInsightsPanel
        key={`${indicator.id}-insights`}
        indicator={indicator}
        className="min-h-0 min-w-0 flex-1 px-2"
      />

      <IndicatorConfigPanel
        key={`${indicator.id}-config`}
        indicator={indicator}
        activeIndicators={activeIndicators}
        onApply={(params) => {
          onAddIndicator(indicator, params);
        }}
        onRemoveInstance={onRemoveIndicator}
      />
    </>
  );
}
