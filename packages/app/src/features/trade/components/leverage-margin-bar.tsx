/**
 * Top controls bar for the Order Form — displays margin mode, leverage, and a disabled Classic button.
 *
 * This is a presentational component; modal open/close state is managed by the parent.
 */

import { Button } from "@/components/ui/button";

interface LeverageMarginBarProps {
  disabled?: boolean;
  effectiveMarginMode: "cross" | "isolated";
  effectiveLeverage: number;
  onOpenMarginMode: () => void;
  onOpenLeverage: () => void;
}

export function LeverageMarginBar({
  disabled = false,
  effectiveMarginMode,
  effectiveLeverage,
  onOpenMarginMode,
  onOpenLeverage,
}: LeverageMarginBarProps) {
  return (
    <div className="row-actions shrink-0">
      <Button
        variant="secondary"
        onClick={onOpenMarginMode}
        disabled={disabled}
        className="flex-1 truncate text-muted-foreground hover:text-foreground"
        type="button"
      >
        {effectiveMarginMode === "cross" ? "Cross" : "Isolated"}
      </Button>
      <Button
        variant="secondary"
        onClick={onOpenLeverage}
        disabled={disabled}
        className="flex-1 tabular-nums text-muted-foreground hover:text-foreground"
        type="button"
      >
        {effectiveLeverage}x
      </Button>
    </div>
  );
}
