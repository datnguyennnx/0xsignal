import type { EconomicEvent } from "@0xsignal/shared";
import type { JSX } from "react";

import { ExternalLink } from "lucide-react";

import { cn } from "cn";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface EventRowProps {
  event: EconomicEvent;
  className?: string;
}

function formatTime(iso: string, allDay: boolean): string {
  if (allDay) return "All day";
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function EventRow({ event, className }: EventRowProps): JSX.Element {
  const hasSource = event.sourceUrl !== null && event.sourceUrl !== "";

  const content = (
    <div className="flex min-w-0 items-baseline gap-2">
      <span className="shrink-0 type-data text-muted-foreground tabular-nums">
        {formatTime(event.scheduledAt, event.allDay)}
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
    hasSource && "cursor-pointer hover:bg-(--control-hover-bg)",
    className,
  );

  if (hasSource) {
    return (
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
    );
  }

  return <div className={cardClass}>{content}</div>;
}
