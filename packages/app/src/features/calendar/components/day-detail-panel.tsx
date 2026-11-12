import { Fragment, type JSX } from "react";
import type { EconomicEvent } from "@0xsignal/shared";

import { isSameDay } from "date-fns";

import { Region } from "@/components/region";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { AsyncState } from "@/lib/async-state";

import { useNow } from "../hooks/use-now";
import { formatClockTime, formatDayHeading } from "../lib/date-utils";

import { EventRow } from "./event-row";

export interface DayDetailPanelProps {
  date: Date;
  state: AsyncState<EconomicEvent[]>;
  onRetry?: () => void;
}

const SKELETON_KEYS = ["event-1", "event-2", "event-3", "event-4"];

interface EmptyCopy {
  title: string;
  description: string;
}

function emptyCopyFor(reason: "first-use" | "no-results"): EmptyCopy {
  if (reason === "first-use") {
    return {
      title: "No events scheduled",
      description: "Nothing is scheduled for this day yet.",
    };
  }
  return {
    title: "No events scheduled",
    description: "This day has no events. Pick another day.",
  };
}

function NowBar({ now }: { now: Date }): JSX.Element {
  return (
    <Badge
      variant="secondary"
      className="self-start bg-muted font-normal text-muted-foreground tabular-nums"
    >
      now {formatClockTime(now)}
    </Badge>
  );
}

export function DayDetailPanel({ date, state, onRetry }: DayDetailPanelProps): JSX.Element {
  const heading = formatDayHeading(date);
  const now = useNow();
  const showNowBar = isSameDay(date, now);
  const empty = emptyCopyFor(state.status === "empty" ? state.reason : "no-results");

  return (
    <div className="flex h-full flex-col gap-stack">
      <h3 className="flex items-baseline justify-between gap-inline type-title font-semibold tracking-tight text-foreground">
        <span>{heading}</span>
        {state.status === "ready" && (
          <span className="type-data font-normal text-muted-foreground">
            {state.data.length} {state.data.length === 1 ? "event" : "events"}
          </span>
        )}
      </h3>

      <Region
        state={state}
        label="Day events"
        className="flex flex-col gap-stack"
        skeleton={
          <div className="flex flex-col gap-inline">
            {SKELETON_KEYS.map((key) => (
              <Skeleton key={key} className="h-16 w-full" />
            ))}
          </div>
        }
        empty={empty}
        error={
          onRetry === undefined
            ? { title: "Unable to load events" }
            : { title: "Unable to load events", retry: onRetry }
        }
      >
        {(events) => {
          const sorted = events.toSorted((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
          const nowBarIndex = showNowBar
            ? sorted.findIndex((event) => event.scheduledAt > now.toISOString())
            : -1;

          return (
            <div className="flex flex-col gap-stack">
              <TooltipProvider>
                <div className="flex flex-col gap-inline">
                  {sorted.map((event, index) => (
                    <Fragment key={event.id}>
                      {index === nowBarIndex && <NowBar now={now} />}
                      <EventRow event={event} />
                    </Fragment>
                  ))}
                </div>
              </TooltipProvider>
              {showNowBar && nowBarIndex === -1 && <NowBar now={now} />}
            </div>
          );
        }}
      </Region>
    </div>
  );
}
