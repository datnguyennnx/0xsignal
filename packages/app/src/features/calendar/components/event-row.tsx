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
  const content = (
    <div className="flex min-w-0 items-baseline gap-2">
      <span className="shrink-0 text-[length:var(--text-data)] tabular-nums text-muted-foreground">
        {formatTime(event.scheduledAt, event.allDay)}
      </span>
      <span className="min-w-0 flex-1 truncate text-[length:var(--text-data)] font-medium text-foreground">
        {event.title}
      </span>
      {event.sourceUrl !== null && event.sourceUrl !== "" && (
        <ExternalLink
          className="size-3.5 shrink-0 self-center text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden="true"
        />
      )}
    </div>
  );

  const cardClass = cn(
    "group rounded-xl bg-muted p-3 transition-colors",
    event.sourceUrl !== null && event.sourceUrl !== "" && "cursor-pointer hover:bg-muted/60",
    className,
  );

  if (event.sourceUrl !== null && event.sourceUrl !== "") {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <a
              href={event.sourceUrl}
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
