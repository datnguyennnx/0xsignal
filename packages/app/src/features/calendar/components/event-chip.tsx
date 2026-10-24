import type { CalendarCategory, EconomicEvent } from "@0xsignal/shared";
import type { JSX } from "react";

import { cn } from "cn";
import { SELECTED_ITEM_CLASS } from "@/lib/state-classes";

export interface EventChipProps {
  event: EconomicEvent;
  onClick?: ((event: EconomicEvent) => void) | undefined;
  className?: string;
}

const CATEGORY_STYLE: Record<CalendarCategory, string> = {
  macro: "border-border bg-secondary text-secondary-foreground",
  fx: cn("border-border", SELECTED_ITEM_CLASS),
  crypto: "border-border bg-muted text-muted-foreground",
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function EventChip({ event, onClick, className }: EventChipProps): JSX.Element {
  const time = event.allDay ? null : formatTime(event.scheduledAt);

  const content = (
    <>
      {time !== null && <span className="shrink-0 tabular-nums">{time}</span>}
      <span className="truncate">{event.title}</span>
    </>
  );

  const classes = cn(
    "flex w-full items-center gap-1.5 overflow-hidden rounded-[var(--radius-chip,0.375rem)] border px-2 py-1 text-left text-xs transition-colors",
    CATEGORY_STYLE[event.category],
    onClick && "cursor-pointer hover:border-foreground/40",
    className,
  );

  if (onClick) {
    return (
      <button
        type="button"
        title={event.title}
        className={classes}
        onClick={() => {
          onClick(event);
        }}
      >
        {content}
      </button>
    );
  }

  return (
    <span title={event.title} className={classes}>
      {content}
    </span>
  );
}
