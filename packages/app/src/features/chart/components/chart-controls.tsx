import { memo } from "react";
import type { ActiveIndicator, IndicatorConfig } from "@0xsignal/shared";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Maximize2, Minimize2, RefreshCcw } from "lucide-react";
import { IndicatorButton } from "./indicator-button";

interface ChartControlsProps {
  activeIndicators: ActiveIndicator[];
  onAddIndicator: (config: IndicatorConfig, params?: Record<string, number>) => void;
  onRemoveIndicator: (id: string) => void;
  hasActiveOverlays: boolean;
  onResetAll: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

export const ChartControls = memo(function ChartControls({
  activeIndicators,
  onAddIndicator,
  onRemoveIndicator,
  hasActiveOverlays,
  onResetAll,
  isFullscreen,
  onToggleFullscreen,
}: ChartControlsProps) {
  return (
    <div className="flex items-center gap-[clamp(0.25rem,0.5vw,0.5rem)]">
      <div className="hidden xl:flex">
        <IndicatorButton
          activeIndicators={activeIndicators}
          onAddIndicator={onAddIndicator}
          onRemoveIndicator={onRemoveIndicator}
        />
      </div>
      {hasActiveOverlays && (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                onClick={onResetAll}
                aria-label="Reset all overlays"
                className="px-2 border-border/40 bg-background/70 text-muted-foreground hover:text-foreground hover:bg-muted/40 focus-visible:ring-ring/40"
              />
            }
          >
            <RefreshCcw className="w-3.5 h-3.5" aria-hidden="true" />
          </TooltipTrigger>
          <TooltipContent>Reset all overlays</TooltipContent>
        </Tooltip>
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={onToggleFullscreen}
        aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        className="px-3 border-border/40 bg-background/70 hover:bg-muted/40 focus-visible:ring-ring/40"
      >
        {isFullscreen ? (
          <Minimize2 className="w-3.5 h-3.5" aria-hidden="true" />
        ) : (
          <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
        )}
      </Button>
    </div>
  );
});
