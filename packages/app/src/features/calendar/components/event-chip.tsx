import type { CalendarCategory, EconomicEvent } from "@0xsignal/shared";
import type { JSX } from "react";

import { cn } from "@/core/utils/cn";

export interface EventChipProps {
  event: EconomicEvent;
  onClick?: (event: EconomicEvent) => void;
  className?: string;
}

const CATEGORY_STYLE: Record<CalendarCategory, string> = {
  macro: "border-primary/20 bg-primary/10 text-primary",
  fx: "border-warn/30 bg-warn/10 text-warn",
  crypto: "border-gain/30 bg-gain/10 text-gain",
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
    onClick && "cursor-pointer hover:bg-muted",
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
