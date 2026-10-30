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
        onClick={() => {
          onModeChange("isolated");
        }}
        className={cn(
          "w-full text-left px-4 py-3 rounded-lg border transition-[background-color,border-color,filter] active:brightness-95",
          mode === "isolated"
            ? SELECTED_CARD_CLASS
            : "border-border/40 bg-transparent hover:border-border",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "text-sm font-medium",
                  mode === "isolated" ? "text-foreground" : "text-muted-foreground",
                )}
              >
                Isolated
              </span>
              <Badge
                variant="secondary"
                className="h-5.5 leading-normal rounded px-1.5 font-normal bg-muted text-muted-foreground"
              >
                Recommended
              </Badge>
            </div>
            <p className="text-[length:var(--text-compact)] text-muted-foreground leading-relaxed max-w-sm">
              {MODE_CONFIG.isolated.description}
            </p>
          </div>
          <span
            className={cn(
              "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
              mode === "isolated" ? "border-foreground" : "border-border/60",
            )}
          >
            {mode === "isolated" && <span className="size-2 rounded-full bg-foreground" />}
          </span>
        </div>
      </button>

      <button
        type="button"
        aria-label="Use cross margin"
        onClick={() => {
          onModeChange("cross");
        }}
        className={cn(
          "w-full text-left px-4 py-3 rounded-lg border transition-[background-color,border-color,filter] active:brightness-95",
          mode === "cross"
            ? SELECTED_CARD_CLASS
            : "border-border/40 bg-transparent hover:border-border",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <span
              className={cn(
                "text-sm font-medium",
                mode === "cross" ? "text-foreground" : "text-muted-foreground",
              )}
            >
              Cross
            </span>
            <p className="text-[length:var(--text-compact)] text-muted-foreground leading-relaxed max-w-sm">
              {MODE_CONFIG.cross.description}
            </p>
          </div>
          <span
            className={cn(
              "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
              mode === "cross" ? "border-foreground" : "border-border/60",
            )}
          >
            {mode === "cross" && <span className="size-2 rounded-full bg-foreground" />}
          </span>
        </div>
      </button>
    </>
  );
}
