import { Layers, Activity, Sparkles, XIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { DialogClose } from "@/components/ui/dialog";

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
}

export function IndicatorModalCategoryList({
  category,
  counts,
  onSelectCategory,
}: IndicatorModalCategoryListProps) {
  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex items-center justify-between gap-inline p-panel">
        <h2 className="type-label font-medium text-muted-foreground">Indicators</h2>
        <DialogClose render={<Button variant="ghost" size="icon" aria-label="Close indicators" />}>
          <XIcon />
        </DialogClose>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2 scrollbar-none overscroll-none">
        {categories.map((cat) => {
          const Icon = cat.icon;

          return (
            <Button
              key={cat.id}
              variant="ghost"
              onClick={() => {
                onSelectCategory(cat.id);
              }}
              className={cn(
                "w-full justify-start gap-(--control-gap) transition-[background-color,color,box-shadow] duration-(--duration-fast) focus-ring",
                category === cat.id
                  ? "bg-(--control-active-bg) text-foreground font-semibold hover:bg-(--control-active-bg)"
                  : "font-medium text-muted-foreground hover:bg-(--control-hover-bg) hover:text-foreground",
              )}
            >
              <Icon
                className={cn("size-icon shrink-0", category === cat.id && "text-info")}
                aria-hidden="true"
              />
              <span className="flex-1 truncate text-left">{cat.label}</span>
              <span
                className={cn(
                  "rounded-chip px-1 type-data font-bold tabular-nums",
                  category === cat.id
                    ? "bg-foreground/10 opacity-60"
                    : "bg-muted text-muted-foreground",
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
