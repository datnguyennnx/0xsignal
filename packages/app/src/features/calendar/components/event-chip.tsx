import type { CalendarCategory, EconomicEvent } from "@0xsignal/shared";
import type { JSX } from "react";

import { cn } from "cn";

export interface EventChipProps {
  event: EconomicEvent;
  onClick?: (event: EconomicEvent) => void;
  className?: string;
}

const CATEGORY_STYLE: Record<CalendarCategory, string> = {
  macro: "border-border bg-secondary text-secondary-foreground",
  fx: "border-border bg-accent text-accent-foreground",
  crypto: "border-border bg-muted text-muted-foreground",
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function EventChip({ event, onClick, className }: EventChipProps): JSX.Element {
  const time = event.allDay ? null : formatTime(event.scheduledAt);

  const content = (
    <>
      {time && <span className="shrink-0 tabular-nums">{time}</span>}
      <span className="truncate">{event.title}</span>
    </>
  );

  const classes = cn(
    "flex w-full items-center gap-1.5 overflow-hidden rounded-md border px-2 py-1 text-left text-xs transition-colors",
    CATEGORY_STYLE[event.category],
    onClick && "cursor-pointer hover:border-foreground/30",
    className,
  );

  if (onClick) {
    return (
      <button type="button" title={event.title} className={classes} onClick={() => onClick(event)}>
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
