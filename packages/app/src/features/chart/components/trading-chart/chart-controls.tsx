import { memo } from "react";
import type { ActiveIndicator } from "@0xsignal/shared";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Maximize2, Minimize2, RefreshCcw } from "lucide-react";
import { IndicatorButton } from "../indicator-button";
import { ICTButton, type ICTVisibility, type ICTFeature } from "../../ict";
import { WyckoffButton, type WyckoffVisibility, type WyckoffFeature } from "../../wyckoff";

interface ChartControlsProps {
  ictVisibility: ICTVisibility;
  ictLoading: boolean;
  onToggleICT: (feature: ICTFeature) => void;
  wyckoffVisibility: WyckoffVisibility;
  wyckoffLoading: boolean;
  onToggleWyckoff: (feature: WyckoffFeature) => void;
  activeIndicators: ActiveIndicator[];
  onAddIndicator: (config: any, params?: Record<string, number>) => void;
  onRemoveIndicator: (id: string) => void;
  onToggleIndicator: (id: string) => void;
  hasActiveOverlays: boolean;
  onResetAll: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  variant?: "desktop" | "mobile";
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
  onToggleIndicator,
  hasActiveOverlays,
  onResetAll,
  isFullscreen,
  onToggleFullscreen,
  variant = "desktop",
}: ChartControlsProps) {
  const isMobile = variant === "mobile";

  return (
    <div
      className={
        isMobile
          ? "flex sm:hidden items-center justify-center gap-2 px-2 py-1.5 border-t border-border/50 bg-card"
          : "flex items-center gap-2"
      }
    >
      <ICTButton visibility={ictVisibility} onToggle={onToggleICT} isLoading={ictLoading} />
      <WyckoffButton
        visibility={wyckoffVisibility}
        onToggle={onToggleWyckoff}
        isLoading={wyckoffLoading}
      />
      <IndicatorButton
        activeIndicators={activeIndicators}
        onAddIndicator={onAddIndicator}
        onRemoveIndicator={onRemoveIndicator}
        onToggleIndicator={onToggleIndicator}
      />
      {hasActiveOverlays && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={onResetAll}
              className="px-2 text-muted-foreground hover:text-foreground"
            >
              <RefreshCcw className="w-3.5 h-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Reset all overlays</TooltipContent>
        </Tooltip>
      )}
      {!isMobile && (
        <Button variant="outline" size="sm" onClick={onToggleFullscreen} className="px-3">
          {isFullscreen ? (
            <Minimize2 className="w-3.5 h-3.5" />
          ) : (
            <Maximize2 className="w-3.5 h-3.5" />
          )}
        </Button>
      )}
    </div>
  );
});
