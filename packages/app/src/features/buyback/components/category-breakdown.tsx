/**
 * Category Breakdown - Pure computation with Card component
 */

import type { CategoryBuybackStats } from "@0xsignal/shared";
import { cn } from "@/core/utils/cn";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface CategoryBreakdownProps {
  readonly categories: Record<string, CategoryBuybackStats>;
}

export function CategoryBreakdown({ categories }: CategoryBreakdownProps) {
  const sorted = Object.values(categories)
    .filter((c) => c.averageBuybackRate > 0.1)
    .sort((a, b) => b.averageBuybackRate - a.averageBuybackRate);

  if (sorted.length === 0) return null;

  const maxRate = Math.max(...sorted.map((c) => c.averageBuybackRate));
  const highYieldCategories = sorted.filter((c) => c.averageBuybackRate >= 10).length;

  return (
    <Card className="py-0 shadow-none">
      <CardHeader className="px-4 py-3 border-b border-border/50">
        <div className="flex items-baseline justify-between">
          <CardTitle className="text-sm">By Category</CardTitle>
          <Badge variant="secondary" className="text-[10px]">
            {highYieldCategories} high yield
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        {sorted.map((cat) => {
          const width = (cat.averageBuybackRate / maxRate) * 100;
          const isHighYield = cat.averageBuybackRate >= 10;

          return (
            <div key={cat.category} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground truncate max-w-[140px]">{cat.category}</span>
                <span className={cn("tabular-nums font-medium", isHighYield && "text-gain")}>
                  {cat.averageBuybackRate.toFixed(1)}%
                </span>
              </div>
              <Progress value={width} className={cn("h-1.5", isHighYield && "[&>div]:bg-gain")} />
            </div>
          );
        })}
        <p className="text-[10px] text-muted-foreground pt-2">
          Average annualized yield by protocol category
        </p>
      </CardContent>
    </Card>
  );
}
