import type { CalendarCategory, EconomicEvent } from "@0xsignal/shared";
import type { CSSProperties, JSX } from "react";

import { cn } from "cn";

import { formatEventTime } from "../lib/date-utils";

export interface EventChipProps {
  event: EconomicEvent;
  className?: string;
}

const CATEGORY_SLOT: Record<CalendarCategory, string> = {
  macro: "--data-series-1",
  fx: "--data-series-2",
  crypto: "--data-series-3",
};

const CATEGORY_LETTER: Record<CalendarCategory, string> = {
  macro: "M",
  fx: "F",
  crypto: "C",
};

const CHIP_CLASS =
  "flex w-full min-w-0 items-center gap-1 overflow-hidden rounded-chip bg-secondary px-1 py-1 type-data text-secondary-foreground";

export function EventChip({ event, className }: EventChipProps): JSX.Element {
  const time = event.allDay ? null : formatEventTime(event.scheduledAt);

  const style: CSSProperties & Record<"--category-color", string> = {
    "--category-color": `var(${CATEGORY_SLOT[event.category]})`,
  };

  return (
    <span title={event.title} style={style} className={cn(CHIP_CLASS, className)}>
      <span
        aria-hidden="true"
        className="flex size-icon shrink-0 items-center justify-center rounded-chip bg-(--category-color) type-label font-semibold text-primary-foreground"
      >
        {CATEGORY_LETTER[event.category]}
      </span>
      <span className="min-w-0 flex-1 truncate">{event.title}</span>
      {time !== null && (
        <span className="shrink-0 type-label text-muted-foreground tabular-nums">{time}</span>
      )}
    </span>
  );
}
