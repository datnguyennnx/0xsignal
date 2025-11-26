import { memo, useMemo } from "react";
import type { CategoryBuybackStats } from "@0xsignal/shared";
import { cn } from "@/core/utils/cn";

interface CategoryBreakdownProps {
  readonly categories: Record<string, CategoryBuybackStats>;
}

export const CategoryBreakdown = memo(function CategoryBreakdown({
  categories,
}: CategoryBreakdownProps) {
  const sorted = useMemo(() => {
    return Object.values(categories)
      .filter((c) => c.averageBuybackRate > 0.1)
      .sort((a, b) => b.averageBuybackRate - a.averageBuybackRate)
      .slice(0, 6);
  }, [categories]);

  if (sorted.length === 0) return null;

  const maxRate = Math.max(...sorted.map((c) => c.averageBuybackRate));

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">Categories</h3>
      <div className="space-y-2.5">
        {sorted.map((cat) => {
          const width = (cat.averageBuybackRate / maxRate) * 100;
          const isHighYield = cat.averageBuybackRate >= 10;

          return (
            <div key={cat.category} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground truncate max-w-[140px]">{cat.category}</span>
                <span className={cn("tabular-nums font-medium", isHighYield && "text-gain")}>
                  {cat.averageBuybackRate.toFixed(1)}%
                </span>
              </div>
              <div className="h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    isHighYield ? "bg-gain" : "bg-foreground/40"
                  )}
                  style={{ width: `${width}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
