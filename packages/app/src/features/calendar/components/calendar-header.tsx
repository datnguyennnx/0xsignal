import type { JSX } from "react";
import { ChevronLeft, ChevronRight, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "cn";

import { CalendarCategoryFilter, type CalendarCategoryFilterValue } from "./calendar-filters";

export type { CalendarCategoryFilterValue };

export interface CalendarHeaderProps {
  title: string;
  rangeLabel: string;
  category: CalendarCategoryFilterValue;
  onCategoryChange: (v: CalendarCategoryFilterValue) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onRefresh: () => void;
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
    <div className="flex flex-wrap items-center justify-between gap-inline">
      <div className="flex min-w-0 flex-wrap items-baseline gap-inline">
        <h2 className="type-title font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="type-label text-muted-foreground">{rangeLabel}</p>
      </div>

      <div data-dense className="row-actions flex-wrap">
        <div className="row-actions">
          <Button variant="outline" size="icon" onClick={onPrev} aria-label="Previous period">
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="icon" onClick={onNext} aria-label="Next period">
            <ChevronRight />
          </Button>
        </div>

        <Button variant="outline" onClick={onToday}>
          Today
        </Button>

        <CalendarCategoryFilter value={category} onChange={onCategoryChange} />

        <Button
          variant="outline"
          size="icon"
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
