import { useState, useCallback, useRef, memo } from "react";
import { Settings2 } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ModalDismissReason } from "@/components/ui/modal";
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
  const triggerRef = useRef<HTMLButtonElement>(null);

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  // The modal owns its own dismissal: mirror what it reports instead of toggling.
  const handleOpenChange = useCallback((next: boolean, reason?: ModalDismissReason) => {
    setIsOpen(next);
    if (next) return;
    // `focus-out` moved focus deliberately; that is the one reason `Modal` must not undo.
    if (reason === "focus-out") return;
    triggerRef.current?.focus({ preventScroll: true });
  }, []);

  const indicatorCount = activeIndicators.length;

  return (
    <>
      <Button
        ref={triggerRef}
        variant={isOpen ? "default" : "outline"}
        size="sm"
        onClick={handleToggle}
        aria-expanded={isOpen}
        className={cn(
          "gap-[clamp(0.2rem,0.4vw,0.375rem)] px-2 sm:px-3 border-border/40 focus-visible:ring-ring/40",
          !isOpen && "bg-background/70 hover:bg-muted/40",
          className,
        )}
      >
        <Settings2 className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Indicators</span>
        {indicatorCount > 0 && (
          <Badge
            variant={isOpen ? "secondary" : "default"}
            className={cn(
              "px-1 sm:px-1.5 py-0 text-[length:var(--text-data)] h-4 min-w-[1rem] tabular-nums select-none",
              isOpen && "bg-background/20 text-background",
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
        onOpenChange={handleOpenChange}
      />
    </>
  );
});
