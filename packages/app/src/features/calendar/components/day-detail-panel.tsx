import { Fragment, type JSX } from "react";
import type { EconomicEvent } from "@0xsignal/shared";

import { format, isSameDay } from "date-fns";

import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

import { useNow } from "../hooks/use-now";

import { EventRow } from "./event-row";

export interface DayDetailPanelProps {
  date: Date;
  events: EconomicEvent[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

const SKELETON_KEYS = ["event-1", "event-2", "event-3", "event-4"];

function NowBar({ now }: { now: Date }): JSX.Element {
  return (
    <Badge
      variant="secondary"
      className="self-start bg-muted font-normal text-muted-foreground tabular-nums"
    >
      now {format(now, "h:mm a")}
    </Badge>
  );
}

export function DayDetailPanel({
  date,
  events,
  isLoading = false,
  isError = false,
  onRetry,
}: DayDetailPanelProps): JSX.Element {
  const heading = date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  const now = useNow();
  const sorted = events.toSorted((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const showNowBar = isSameDay(date, now);
  const nowBarIndex = showNowBar
    ? sorted.findIndex((event) => event.scheduledAt > now.toISOString())
    : -1;

  return (
    <div className="flex h-full flex-col gap-3">
      <h3 className="flex items-baseline justify-between gap-2 text-sm font-medium tracking-tight text-foreground">
        <span>{heading}</span>
        {!isLoading && !isError && (
          <span className="text-[length:var(--text-data)] font-normal text-muted-foreground">
            {sorted.length} {sorted.length === 1 ? "event" : "events"}
          </span>
        )}
      </h3>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {SKELETON_KEYS.map((key) => (
            <Skeleton key={key} className="h-16 w-full" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState
          title="Unable to load events"
          retryAction={onRetry}
          className="min-h-[clamp(10rem,30vh,16rem)]"
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
          {sorted.length === 0 ? (
            <div className="flex flex-1 items-center justify-center min-h-[clamp(12rem,30vh,18rem)]">
              <EmptyState
                variant="panel"
                title="No events scheduled"
                description="Pick another day or adjust your filters to find upcoming events."
              />
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {sorted.map((event, index) => (
                <Fragment key={event.id}>
                  {index === nowBarIndex && <NowBar now={now} />}
                  <EventRow event={event} />
                </Fragment>
              ))}
            </div>
          )}
          {showNowBar && nowBarIndex === -1 && <NowBar now={now} />}
        </div>
      )}
    </div>
  );
}
