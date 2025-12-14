import { memo } from "react";
import type { ActiveIndicator } from "@0xsignal/shared";
import { IndicatorLegend } from "../indicator-legend";
import { ICTLegend, type ICTVisibility, type ICTAnalysisResult } from "../../ict";
import { WyckoffLegend, type WyckoffVisibility, type WyckoffAnalysisResult } from "../../wyckoff";

interface ChartOverlaysProps {
  ictEnabled: boolean;
  ictAnalysis: ICTAnalysisResult | null;
  ictVisibility: ICTVisibility;
  wyckoffEnabled: boolean;
  wyckoffAnalysis: WyckoffAnalysisResult | null;
  wyckoffVisibility: WyckoffVisibility;
  activeIndicators: ActiveIndicator[];
  onToggleIndicator: (id: string) => void;
  onRemoveIndicator: (id: string) => void;
}

export const ChartOverlays = memo(function ChartOverlays({
  ictEnabled,
  ictAnalysis,
  ictVisibility,
  wyckoffEnabled,
  wyckoffAnalysis,
  wyckoffVisibility,
  activeIndicators,
  onToggleIndicator,
  onRemoveIndicator,
}: ChartOverlaysProps) {
  return (
    <div className="absolute top-2 left-2 z-10 flex flex-col gap-1.5">
      {ictEnabled && ictAnalysis && <ICTLegend analysis={ictAnalysis} visibility={ictVisibility} />}
      {wyckoffEnabled && wyckoffAnalysis && (
        <WyckoffLegend analysis={wyckoffAnalysis} visibility={wyckoffVisibility} />
      )}
      {activeIndicators.length > 0 && (
        <IndicatorLegend
          indicators={activeIndicators}
          onToggle={onToggleIndicator}
          onRemove={onRemoveIndicator}
        />
      )}
    </div>
  );
});
