/**
 * Top controls bar for the Order Form — displays margin mode, leverage, and a disabled Classic button.
 *
 * This is a presentational component; modal open/close state is managed by the parent.
 */

interface LeverageMarginBarProps {
  effectiveMarginMode: "cross" | "isolated";
  effectiveLeverage: number;
  onOpenMarginMode: () => void;
  onOpenLeverage: () => void;
}

export function LeverageMarginBar({
  effectiveMarginMode,
  effectiveLeverage,
  onOpenMarginMode,
  onOpenLeverage,
}: LeverageMarginBarProps) {
  return (
    <div className="flex items-center gap-[clamp(0.75rem,1vw,1rem)] shrink-0">
      <button
        onClick={onOpenMarginMode}
        className="flex-1 h-9 px-2 text-xs font-medium text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/30 rounded border border-border/30 transition-colors truncate active:scale-[0.97] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        type="button"
      >
        {effectiveMarginMode === "cross" ? "Cross" : "Isolated"}
      </button>
      <button
        onClick={onOpenLeverage}
        className="flex-1 h-9 px-2 text-xs tabular-nums text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/30 rounded border border-border/30 transition-colors active:scale-[0.97] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        type="button"
      >
        {effectiveLeverage}x
      </button>
      <button
        disabled
        className="flex-1 h-9 px-2 text-xs text-muted-foreground/50 border border-transparent truncate cursor-not-allowed"
        type="button"
      >
        Classic
      </button>
    </div>
  );
}
