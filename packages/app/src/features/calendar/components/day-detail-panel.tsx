import { Fragment, type JSX } from "react";
import type { EconomicEvent } from "@0xsignal/shared";

import { format, isSameDay } from "date-fns";

import { ErrorState } from "@/components/error-state";
import { Skeleton } from "@/components/ui/skeleton";

import { useNow } from "../hooks/use-now";

import { EventRow } from "./event-row";

export interface DayDetailPanelProps {
  date: Date;
  events: EconomicEvent[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?(): void;
}

function NowBar({ now }: { now: Date }): JSX.Element {
  return (
    <div className="flex items-center gap-2 py-3 text-xs text-loss">
      <span className="tabular-nums">now {format(now, "h:mm a")}</span>
      <span className="h-px flex-1 border-t border-dashed border-loss" />
    </div>
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
  const sorted = [...events].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const showNowBar = isSameDay(date, now);
  const nowBarIndex = showNowBar
    ? sorted.findIndex((event) => event.scheduledAt > now.toISOString())
    : -1;

  return (
    <aside className="flex w-80 shrink-0 flex-col gap-3 rounded-xl border border-border/20 bg-card p-4">
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
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState
          title="Unable to load events"
          retryAction={onRetry}
          className="min-h-[clamp(10rem,30vh,16rem)]"
        />
      ) : (
        <div className="flex flex-col gap-3 overflow-y-auto">
          {sorted.length === 0 ? (
            <div className="flex items-center justify-center py-6 text-[length:var(--text-data)] text-muted-foreground/40">
              No events scheduled
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
    </aside>
  );
}
