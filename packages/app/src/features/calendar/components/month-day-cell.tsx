import type { JSX } from "react";
import type { EconomicEvent } from "@0xsignal/shared";

import { cn } from "@/core/utils/cn";

import { EventChip } from "./event-chip";

export interface MonthDayCellProps {
  date: Date;
  events: EconomicEvent[];
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  maxVisible?: number;
  onSelect(date: Date): void;
  onEventClick?(event: EconomicEvent): void;
  onShowMore?(date: Date): void;
}

export function MonthDayCell({
  date,
  events,
  isCurrentMonth,
  isToday,
  isSelected,
  maxVisible = 3,
  onSelect,
  onEventClick,
  onShowMore,
}: MonthDayCellProps): JSX.Element {
  const visible = events.slice(0, maxVisible);
  const overflow = events.length - visible.length;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      onClick={() => onSelect(date)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(date);
        }
      }}
      className={cn(
        "flex min-h-[8rem] cursor-pointer flex-col gap-1.5 border-r border-b border-border/40 p-2 text-left transition-colors hover:bg-accent/40",
        isSelected && "bg-accent/60",
        isToday && "ring-1 ring-primary/50 ring-inset",
        !isCurrentMonth && "bg-muted/30 text-muted-foreground/50",
      )}
    >
      <div className="flex justify-end">
        <span
          className={cn(
            "flex size-6 items-center justify-center rounded-full text-xs font-medium tabular-nums",
            isSelected
              ? "bg-primary text-primary-foreground"
              : !isCurrentMonth
                ? "text-muted-foreground/50"
                : isToday
                  ? "text-primary"
                  : "text-foreground",
          )}
        >
          {date.getDate()}
        </span>
      </div>

      <div className="flex min-w-0 flex-col gap-1">
        {visible.map((event) => (
          <div
            key={event.id}
            className="min-w-0"
            onClick={(clickEvent) => clickEvent.stopPropagation()}
          >
            <EventChip event={event} onClick={onEventClick} />
          </div>
        ))}

        {overflow > 0 && (
          <button
            type="button"
            onClick={(clickEvent) => {
              clickEvent.stopPropagation();
              onShowMore?.(date);
            }}
            className="rounded-md px-2 py-0.5 text-left text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
          >
            +{overflow} more
          </button>
        )}
      </div>
    </div>
  );
}
