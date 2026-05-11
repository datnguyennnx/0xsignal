/**
 * @overview Trading Chart Global Controls
 *
 * Provides primary toggles for overlays (ICT, Wyckoff), indicator management, and view modes.
 * Features support for full-screen mode toggling.
 *
 * @mechanism
 * - utilizes sub-components (ICTButton, WyckoffButton, IndicatorButton) for modularity.
 * - provides a clean, unified interface for all chart-level interactions.
 */
import { memo } from "react";
import type { ActiveIndicator, IndicatorConfig } from "@0xsignal/shared";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Maximize2, Minimize2, RefreshCcw } from "lucide-react";
import { IndicatorButton } from "../components/indicator-button";
import { ICTButton, type ICTVisibility, type ICTFeature } from "../ict";
import { WyckoffButton, type WyckoffVisibility, type WyckoffFeature } from "../wyckoff";

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
      <ICTButton visibility={ictVisibility} onToggle={onToggleICT} isLoading={ictLoading} />
      <WyckoffButton
        visibility={wyckoffVisibility}
        onToggle={onToggleWyckoff}
        isLoading={wyckoffLoading}
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
