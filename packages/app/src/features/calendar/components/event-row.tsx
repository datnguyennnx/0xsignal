import type { EconomicEvent } from "@0xsignal/shared";
import type { JSX } from "react";

import { Bell, ExternalLink } from "lucide-react";

import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { formatEventTime } from "../lib/date-utils";

interface EventRowProps {
  event: EconomicEvent;
  now: number;
  className?: string;
  onAlert?: (event: EconomicEvent) => void;
}

export function EventRow({ event, now, className, onAlert }: EventRowProps): JSX.Element {
  const hasSource = event.sourceUrl !== null && event.sourceUrl !== "";
  const alertDisabled =
    event.impact === "low" || event.currency === null || Date.parse(event.scheduledAt) <= now;

  const content = (
    <div className="flex min-w-0 items-baseline gap-2">
      <span className="shrink-0 type-data text-muted-foreground tabular-nums">
        {formatEventTime(event.scheduledAt, event.allDay)}
      </span>
      <span className="min-w-0 flex-1 truncate type-data font-medium text-foreground">
        {event.title}
      </span>
      {hasSource && (
        <ExternalLink
          className="size-icon-sm shrink-0 self-center text-muted-foreground opacity-0 motion-fade group-hover:opacity-100"
          aria-hidden="true"
        />
      )}
    </div>
  );

  const cardClass = cn(
    "group rounded-control bg-(--control-bg) p-2 motion-control",
    onAlert !== undefined && "min-w-0 flex-1",
    hasSource && "cursor-pointer hover:bg-(--control-hover-bg)",
    className,
  );

  const card = hasSource ? (
    <Tooltip>
      <TooltipTrigger
        render={
          <a
            href={event.sourceUrl ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            className={cardClass}
          >
            {content}
          </a>
        }
      />
      <TooltipContent>{event.attribution}</TooltipContent>
    </Tooltip>
  ) : (
    <div className={cardClass}>{content}</div>
  );

  if (onAlert === undefined) return card;

  return (
    <div className="flex items-center gap-1">
      {card}
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Alert me before ${event.title}`}
        disabled={alertDisabled}
        onClick={() => {
          onAlert(event);
        }}
      >
        <Bell aria-hidden="true" />
      </Button>
    </div>
  );
}
