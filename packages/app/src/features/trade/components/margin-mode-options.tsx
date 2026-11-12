import { Badge } from "@/components/ui/badge";
import { SELECTED_CARD_CLASS } from "@/lib/state-classes";
import { cn } from "cn";

const MODE_CONFIG = {
  isolated: {
    title: "Isolated",
    description:
      "Isolated margin is used for isolated positions. Your position's margin is not shared with other positions. You can manage your isolated positions by adjusting the isolated margin.",
  },
  cross: {
    title: "Cross",
    description:
      "All cross positions share the same cross margin. The cross margin is used to prevent liquidation. If a position is liquidated, the cross margin is distributed among your other cross positions.",
  },
} as const;

interface MarginModeOptionsProps {
  mode: "cross" | "isolated";
  onModeChange: (mode: "cross" | "isolated") => void;
}

export function MarginModeOptions({ mode, onModeChange }: MarginModeOptionsProps) {
  return (
    <>
      <button
        type="button"
        aria-label="Use isolated margin"
        aria-pressed={mode === "isolated"}
        onClick={() => {
          onModeChange("isolated");
        }}
        className={cn(
          "w-full text-left px-4 py-3 rounded-panel border transition-[background-color,box-shadow,border-color,transform] duration-(--dur-fast) ease-standard active:brightness-95",
          mode === "isolated"
            ? `${SELECTED_CARD_CLASS} shadow-[inset_0_0_0_1px_var(--border),inset_0_1px_0_var(--glass-rim-top),var(--shadow-e2)]`
            : "border-(--option-card-border) bg-(--option-card-bg) hover:bg-(--control-hover-bg)",
        )}
      >
        <div className="flex items-start justify-between gap-stack">
          <div className="space-y-2">
            <div className="flex items-center gap-field">
              <span
                className={cn(
                  "type-body font-medium",
                  mode === "isolated" ? "text-foreground" : "text-muted-foreground",
                )}
              >
                Isolated
              </span>
              <Badge
                variant="secondary"
                className="leading-normal font-normal bg-muted text-muted-foreground"
              >
                Recommended
              </Badge>
            </div>
            <p className="type-body text-muted-foreground leading-relaxed max-w-sm">
              {MODE_CONFIG.isolated.description}
            </p>
          </div>
        </div>
      </button>

      <button
        type="button"
        aria-label="Use cross margin"
        aria-pressed={mode === "cross"}
        onClick={() => {
          onModeChange("cross");
        }}
        className={cn(
          "w-full text-left px-4 py-3 rounded-panel border transition-[background-color,box-shadow,border-color,transform] duration-(--dur-fast) ease-standard active:brightness-95",
          mode === "cross"
            ? `${SELECTED_CARD_CLASS} shadow-[inset_0_0_0_1px_var(--border),inset_0_1px_0_var(--glass-rim-top),var(--shadow-e2)]`
            : "border-(--option-card-border) bg-(--option-card-bg) hover:bg-(--control-hover-bg)",
        )}
      >
        <div className="flex items-start justify-between gap-stack">
          <div className="space-y-2">
            <span
              className={cn(
                "type-body font-medium",
                mode === "cross" ? "text-foreground" : "text-muted-foreground",
              )}
            >
              Cross
            </span>
            <p className="type-body text-muted-foreground leading-relaxed max-w-sm">
              {MODE_CONFIG.cross.description}
            </p>
          </div>
        </div>
      </button>
    </>
  );
}
