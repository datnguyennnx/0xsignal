import { lazy, Suspense, useState, useCallback, memo } from "react";
import { Settings2 } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ActiveIndicator, IndicatorConfig } from "@0xsignal/shared";

const loadIndicatorModal = () => import("./indicator-modal");
const IndicatorModal = lazy(() =>
  loadIndicatorModal().then((m) => ({ default: m.IndicatorModal })),
);

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
  // Mount on first open so the lazy chunk and its exit animation both exist afterwards.
  const [hasOpened, setHasOpened] = useState(false);

  const handleToggle = useCallback(() => {
    setHasOpened(true);
    setIsOpen((prev) => !prev);
  }, []);

  // The dialog owns its own dismissal; mirror the reported state instead of toggling.
  const handleOpenChange = useCallback((next: boolean) => {
    if (next) setHasOpened(true);
    setIsOpen(next);
  }, []);

  const indicatorCount = activeIndicators.length;

  const preloadModal = useCallback(() => {
    void loadIndicatorModal();
  }, []);

  return (
    <>
      <Button
        variant="secondary"
        onClick={handleToggle}
        onPointerEnter={preloadModal}
        onFocus={preloadModal}
        aria-pressed={isOpen}
        className={cn(
          "gap-1 aria-pressed:bg-(--control-active-bg) aria-pressed:text-foreground aria-pressed:shadow-[inset_0_1px_0_var(--control-active-rim)]",
          className,
        )}
      >
        <Settings2 className="size-icon" />
        <span className="hidden sm:inline">Indicators</span>
        {indicatorCount > 0 && (
          <Badge
            variant={isOpen ? "secondary" : "default"}
            className={cn(
              "min-w-[1rem] tabular-nums select-none",
              isOpen && "bg-(--control-active-bg) text-foreground",
            )}
          >
            {indicatorCount}
          </Badge>
        )}
      </Button>

      {hasOpened && (
        <Suspense fallback={null}>
          <IndicatorModal
            activeIndicators={activeIndicators}
            onAddIndicator={onAddIndicator}
            onRemoveIndicator={onRemoveIndicator}
            open={isOpen}
            onOpenChange={handleOpenChange}
          />
        </Suspense>
      )}
    </>
  );
});
