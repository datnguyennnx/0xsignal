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
  maxVisible?: number;
  onSelect: (date: Date) => void;
  onEventClick?: ((event: EconomicEvent) => void) | undefined;
  onShowMore?: (date: Date) => void;
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
      className={cn(
        "relative flex min-h-[8rem] flex-col gap-1.5 rounded-lg p-2 text-left transition-colors hover:bg-accent/40",
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
        className="absolute inset-0 z-0 cursor-pointer rounded-lg focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-inset"
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
          <EventChip
            key={event.id}
            event={event}
            onClick={onEventClick}
            className="pointer-events-auto min-w-0"
          />
        ))}

        {overflow > 0 && (
          <button
            type="button"
            onClick={() => onShowMore?.(date)}
            className="pointer-events-auto rounded-md px-2 py-0.5 text-left text-[length:var(--text-micro)] font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
          >
            +{overflow} more
          </button>
        )}
      </div>
    </div>
  );
}
