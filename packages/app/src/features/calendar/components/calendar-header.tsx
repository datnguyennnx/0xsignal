import type { JSX } from "react";
import { ChevronLeft, ChevronRight, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/core/utils/cn";

import { CalendarCategoryFilter, type CalendarCategoryFilterValue } from "./calendar-filters";

export interface CalendarHeaderProps {
  title: string;
  rangeLabel: string;
  category: CalendarCategoryFilterValue;
  onCategoryChange(v: CalendarCategoryFilterValue): void;
  onPrev(): void;
  onNext(): void;
  onToday(): void;
  onRefresh(): void;
  isRefreshing?: boolean;
}

export function CalendarHeader({
  title,
  rangeLabel,
  category,
  onCategoryChange,
  onPrev,
  onNext,
  onToday,
  onRefresh,
  isRefreshing = false,
}: CalendarHeaderProps): JSX.Element {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="text-[length:var(--text-data)] text-muted-foreground">{rangeLabel}</p>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center rounded-md border border-border/40">
          <Button variant="ghost" size="icon-sm" onClick={onPrev} aria-label="Previous period">
            <ChevronLeft />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={onNext} aria-label="Next period">
            <ChevronRight />
          </Button>
        </div>

        <Button variant="outline" size="sm" className="border-border/40" onClick={onToday}>
          Today
        </Button>

        <CalendarCategoryFilter value={category} onChange={onCategoryChange} />

        <Button
          variant="outline"
          size="icon-sm"
          className="border-border/40"
          onClick={onRefresh}
          disabled={isRefreshing}
          aria-label="Refresh"
        >
          <RotateCw className={cn(isRefreshing && "animate-spin")} />
        </Button>
      </div>
    </div>
  );
}
