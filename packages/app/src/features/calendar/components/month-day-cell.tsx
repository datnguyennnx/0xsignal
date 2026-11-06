import type { JSX } from "react";
import type { EconomicEvent } from "@0xsignal/shared";

import { cn } from "cn";

import { EventChip } from "./event-chip";

export interface MonthDayCellProps {
  date: Date;
  events: EconomicEvent[];
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  onSelect: (date: Date) => void;
}

export function MonthDayCell({
  date,
  events,
  isCurrentMonth,
  isToday,
  isSelected,
  onSelect,
}: MonthDayCellProps): JSX.Element {
  const visible = events.slice(0, 3);
  const overflow = events.length - visible.length;

  return (
    <div
      className={cn(
        "relative flex min-h-[8rem] flex-col gap-1.5 rounded-[calc(var(--radius-panel,0.875rem)-0.25rem)] p-1 m-2 text-left transition-colors hover:bg-accent/40",
        isSelected && "bg-accent text-accent-foreground",
        isToday && "ring-1 ring-primary/40 ring-inset",
        !isCurrentMonth && "bg-muted text-muted-foreground",
      )}
    >
      <button
        type="button"
        aria-pressed={isSelected}
        aria-label={`Select ${date.toLocaleDateString()}`}
        onClick={() => {
          onSelect(date);
        }}
        className="absolute inset-0 z-0 cursor-pointer rounded-[calc(var(--radius-panel,0.875rem)-0.25rem)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      />

      <div className="pointer-events-none relative z-10 flex justify-end">
        <span
          className={cn(
            "flex size-6 items-center justify-center rounded-full text-xs font-medium tabular-nums",
            isSelected
              ? "bg-primary text-primary-foreground"
              : isCurrentMonth
                ? isToday
                  ? "text-primary"
                  : "text-foreground"
                : "text-muted-foreground",
          )}
        >
          {date.getDate()}
        </span>
      </div>

      <div className="pointer-events-none relative z-10 flex min-w-0 flex-col gap-1">
        {visible.map((event) => (
          <EventChip key={event.id} event={event} className="pointer-events-auto min-w-0" />
        ))}
        {overflow > 0 && (
          <span className="px-1 text-xs font-medium text-muted-foreground tabular-nums">
            +{overflow} more
          </span>
        )}
      </div>
    </div>
  );
}
