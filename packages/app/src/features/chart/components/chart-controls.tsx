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
    <div data-dense className="row-actions">
      <IndicatorButton
        activeIndicators={activeIndicators}
        onAddIndicator={onAddIndicator}
        onRemoveIndicator={onRemoveIndicator}
      />
      {hasActiveOverlays && (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="outline"
                size="icon"
                onClick={onResetAll}
                aria-label="Reset all overlays"
                className="text-muted-foreground hover:text-foreground"
              />
            }
          >
            <RefreshCcw className="size-icon" aria-hidden="true" />
          </TooltipTrigger>
          <TooltipContent>Reset all overlays</TooltipContent>
        </Tooltip>
      )}

      <Button
        variant="outline"
        size="icon"
        onClick={onToggleFullscreen}
        aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        aria-pressed={isFullscreen}
      >
        {isFullscreen ? (
          <Minimize2 className="size-icon" aria-hidden="true" />
        ) : (
          <Maximize2 className="size-icon" aria-hidden="true" />
        )}
      </Button>
    </div>
  );
});
