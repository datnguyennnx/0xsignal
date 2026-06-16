import { useState, useCallback, memo } from "react";
import { Settings2 } from "lucide-react";
import { cn } from "@/core/utils/cn";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ActiveIndicator, IndicatorConfig } from "@0xsignal/shared";
import { IndicatorModal } from "./indicator-modal";

interface IndicatorButtonProps {
  activeIndicators: ActiveIndicator[];
  onAddIndicator: (indicator: IndicatorConfig, params?: Record<string, number>) => void;
  onRemoveIndicator: (indicatorId: string) => void;
  className?: string;
}

export const IndicatorButton = memo(function IndicatorButton({
  activeIndicators,
  onAddIndicator,
  onRemoveIndicator,
  className,
}: IndicatorButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = useCallback(() => setIsOpen((prev) => !prev), []);

  const indicatorCount = activeIndicators.length;

  return (
    <>
      <Button
        variant={isOpen ? "default" : "outline"}
        size="sm"
        onClick={handleToggle}
        className={cn(
          "gap-[clamp(0.2rem,0.4vw,0.375rem)] px-2 sm:px-3 border-border/50 bg-background/70 hover:bg-muted/40 focus-visible:ring-ring/25",
          isOpen && "bg-foreground text-background hover:bg-foreground/90",
          className
        )}
      >
        <Settings2 className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Indicators</span>
        {indicatorCount > 0 && (
          <Badge
            variant={isOpen ? "secondary" : "default"}
            className={cn(
              "px-1 sm:px-1.5 py-0 text-[clamp(0.5625rem,0.6rem+0.4vw,0.6875rem)] h-4 min-w-[1rem] tabular-nums select-none",
              isOpen && "bg-background/20 text-background"
            )}
          >
            {indicatorCount}
          </Badge>
        )}
      </Button>

      <IndicatorModal
        activeIndicators={activeIndicators}
        onAddIndicator={onAddIndicator}
        onRemoveIndicator={onRemoveIndicator}
        open={isOpen}
        onOpenChange={setIsOpen}
      />
    </>
  );
});
