/**
 * @overview Trading Chart Global Controls
 *
 * Provides primary toggles for overlays (ICT, Wyckoff), indicator management, and view modes.
 * Features support for full-screen mode toggling.
 *
 * @mechanism
 * - utilizes shared AnalysisButton for ICT/Wyckoff toggle panels.
 * - IndicatorButton handles technical indicator overlay management.
 */
import { memo } from "react";
import type { ActiveIndicator, IndicatorConfig } from "@0xsignal/shared";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Maximize2, Minimize2, RefreshCcw } from "lucide-react";
import { IndicatorButton } from "../components/indicator-button";
import { AnalysisButton } from "../analysis/shared";
import {
  ICT_FEATURES,
  ICT_LABEL,
  ICT_FOOTER,
  type ICTVisibility,
  type ICTFeature,
} from "../analysis/ict";
import {
  WYCKOFF_FEATURES,
  WYCKOFF_LABEL,
  WYCKOFF_FOOTER,
  type WyckoffVisibility,
  type WyckoffFeature,
} from "../analysis/wyckoff";

interface ChartControlsProps {
  ictVisibility: ICTVisibility;
  ictLoading: boolean;
  onToggleICT: (feature: ICTFeature) => void;
  wyckoffVisibility: WyckoffVisibility;
  wyckoffLoading: boolean;
  onToggleWyckoff: (feature: WyckoffFeature) => void;
  activeIndicators: ActiveIndicator[];
  onAddIndicator: (config: IndicatorConfig, params?: Record<string, number>) => void;
  onRemoveIndicator: (id: string) => void;
  hasActiveOverlays: boolean;
  onResetAll: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

export const ChartControls = memo(function ChartControls({
  ictVisibility,
  ictLoading,
  onToggleICT,
  wyckoffVisibility,
  wyckoffLoading,
  onToggleWyckoff,
  activeIndicators,
  onAddIndicator,
  onRemoveIndicator,
  hasActiveOverlays,
  onResetAll,
  isFullscreen,
  onToggleFullscreen,
}: ChartControlsProps) {
  return (
    <div className="flex items-center gap-2">
      <AnalysisButton
        label={ICT_LABEL}
        features={ICT_FEATURES}
        visibility={ictVisibility as unknown as Record<string, boolean>}
        onToggle={(f) => onToggleICT(f as ICTFeature)}
        isLoading={ictLoading}
        footerText={ICT_FOOTER.text}
        footerSubtext={ICT_FOOTER.subtext}
      />
      <AnalysisButton
        label={WYCKOFF_LABEL}
        features={WYCKOFF_FEATURES}
        visibility={wyckoffVisibility as unknown as Record<string, boolean>}
        onToggle={(f) => onToggleWyckoff(f as WyckoffFeature)}
        isLoading={wyckoffLoading}
        footerText={WYCKOFF_FOOTER.text}
        footerSubtext={WYCKOFF_FOOTER.subtext}
      />

      <div className="hidden xl:flex">
        <IndicatorButton
          activeIndicators={activeIndicators}
          onAddIndicator={onAddIndicator}
          onRemoveIndicator={onRemoveIndicator}
        />
      </div>
      {hasActiveOverlays && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={onResetAll}
              className="px-2 min-h-[44px] border-border/50 bg-background/70 text-muted-foreground hover:text-foreground hover:bg-muted/40 focus-visible:ring-ring/25"
            >
              <RefreshCcw className="w-3.5 h-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Reset all overlays</TooltipContent>
        </Tooltip>
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={onToggleFullscreen}
        aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        className="px-3 border-border/50 bg-background/70 hover:bg-muted/40 focus-visible:ring-ring/25"
      >
        {isFullscreen ? (
          <Minimize2 className="w-3.5 h-3.5" />
        ) : (
          <Maximize2 className="w-3.5 h-3.5" />
        )}
      </Button>
    </div>
  );
});
