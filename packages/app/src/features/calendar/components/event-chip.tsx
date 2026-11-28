import type { CalendarCategory, EconomicEvent } from "@0xsignal/shared";
import type { JSX } from "react";

import { Banknote, Bitcoin, Landmark, type LucideIcon } from "lucide-react";

import { cn } from "cn";

import { formatEventTime } from "../lib/date-utils";

export interface EventChipProps {
  event: EconomicEvent;
  className?: string;
}

const CATEGORY_ICON: Record<CalendarCategory, LucideIcon> = {
  macro: Landmark,
  fx: Banknote,
  crypto: Bitcoin,
};

const CATEGORY_ICON_CLASS: Record<CalendarCategory, string> = {
  macro: "text-(--data-series-1)",
  fx: "text-(--data-series-2)",
  crypto: "text-(--data-series-3)",
};

const CHIP_CLASS =
  "flex h-8 w-full min-w-0 shrink-0 items-center gap-2 overflow-hidden rounded-control bg-secondary px-2 type-data text-secondary-foreground";

export function EventChip({ event, className }: EventChipProps): JSX.Element {
  const time = event.allDay ? null : formatEventTime(event.scheduledAt);
  const CategoryIcon = CATEGORY_ICON[event.category];

  return (
    <span title={event.title} className={cn(CHIP_CLASS, className)}>
      <CategoryIcon
        aria-hidden="true"
        strokeWidth={1.5}
        className={cn("size-4 shrink-0", CATEGORY_ICON_CLASS[event.category])}
      />
      <span className="min-w-0 flex-1 truncate">{event.title}</span>
      {time !== null && (
        <span className="shrink-0 text-right text-muted-foreground tabular-nums">{time}</span>
      )}
    </span>
  );
}
