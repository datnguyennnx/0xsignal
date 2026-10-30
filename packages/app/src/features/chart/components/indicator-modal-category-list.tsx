import { Layers, Activity, Sparkles, X } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";

export type IndicatorCategory = "active" | "overlays" | "oscillators";

const categories: { id: IndicatorCategory; label: string; icon: typeof Sparkles }[] = [
  { id: "active", label: "Active", icon: Sparkles },
  { id: "overlays", label: "Overlays", icon: Layers },
  { id: "oscillators", label: "Oscillators", icon: Activity },
];

interface IndicatorModalCategoryListProps {
  category: IndicatorCategory;
  counts: Record<IndicatorCategory, number>;
  onSelectCategory: (category: IndicatorCategory) => void;
  onClose: () => void;
}

export function IndicatorModalCategoryList({
  category,
  counts,
  onSelectCategory,
  onClose,
}: IndicatorModalCategoryListProps) {
  return (
    <div className="w-fit shrink-0 min-w-[11rem] max-w-[17rem] max-sm:w-full max-sm:max-w-none flex flex-col min-h-0 sm:max-h-[clamp(18rem,80dvh,60rem)]">
      <div className="p-4 sm:p-6 flex items-center justify-between sm:justify-start gap-[clamp(0.25rem,0.5vw,0.5rem)]">
        <h2 className="text-xs font-semibold text-muted-foreground">Indicators</h2>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onClose}
          aria-label="Close"
          className="sm:hidden min-h-8 min-w-8 tap-highlight text-muted-foreground hover:bg-muted/40 hover:text-foreground focus-visible:ring-[2px] focus-visible:ring-ring/40"
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5 min-h-0 scrollbar-none overscroll-none">
        {categories.map((cat) => {
          const Icon = cat.icon;

          return (
            <Button
              key={cat.id}
              variant="ghost"
              size="xs"
              onClick={() => {
                onSelectCategory(cat.id);
              }}
              className={cn(
                "h-auto w-full justify-start gap-[clamp(0.3rem,0.6vw,0.625rem)] px-3 py-3 sm:py-2 rounded text-xs transition-[background-color,color,box-shadow] duration-150 focus-visible:ring-[2px] focus-visible:ring-ring/40",
                category === cat.id
                  ? "bg-accent text-foreground font-semibold hover:bg-accent"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/60 font-medium",
              )}
            >
              <Icon
                className={cn("size-3.5 shrink-0", category === cat.id && "text-primary")}
                aria-hidden="true"
              />
              <span className="flex-1 text-left truncate">{cat.label}</span>
              <span
                className={cn(
                  "text-[length:var(--text-data)] px-1 rounded tabular-nums font-bold",
                  category === cat.id
                    ? "bg-foreground/10 opacity-60"
                    : "bg-muted text-muted-foreground/60",
                )}
              >
                {counts[cat.id]}
              </span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
