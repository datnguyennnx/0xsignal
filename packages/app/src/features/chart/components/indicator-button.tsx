import { useState, useCallback, memo } from "react";
import { Settings2 } from "lucide-react";
import { cn } from "@/core/utils/cn";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ActiveIndicator, IndicatorConfig } from "@0xsignal/shared";
import { IndicatorSelector } from "./indicator-selector";

interface IndicatorButtonProps {
  activeIndicators: ActiveIndicator[];
  onAddIndicator: (indicator: IndicatorConfig, params?: Record<string, number>) => void;
  onRemoveIndicator: (indicatorId: string) => void;
  onToggleIndicator: (indicatorId: string) => void;
  className?: string;
}

export const IndicatorButton = memo(function IndicatorButton({
  activeIndicators,
  onAddIndicator,
  onRemoveIndicator,
  onToggleIndicator,
  className,
}: IndicatorButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = useCallback(() => setIsOpen((prev) => !prev), []);
  const handleClose = useCallback(() => setIsOpen(false), []);

  const indicatorCount = activeIndicators.length;

  return (
    <div className={cn("relative", className)}>
      <Button
        variant={isOpen ? "default" : "outline"}
        size="sm"
        onClick={handleToggle}
        className="gap-1.5 px-2 sm:px-3"
      >
        <Settings2 className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Indicators</span>
        {indicatorCount > 0 && (
          <Badge
            variant={isOpen ? "secondary" : "default"}
            className={cn(
              "px-1 sm:px-1.5 py-0 text-[10px] h-4 min-w-[16px]",
              isOpen && "bg-primary-foreground/20"
            )}
          >
            {indicatorCount}
          </Badge>
        )}
      </Button>

      <IndicatorSelector
        activeIndicators={activeIndicators}
        onAddIndicator={onAddIndicator}
        onRemoveIndicator={onRemoveIndicator}
        onToggleIndicator={onToggleIndicator}
        isOpen={isOpen}
        onClose={handleClose}
      />
    </div>
  );
});
