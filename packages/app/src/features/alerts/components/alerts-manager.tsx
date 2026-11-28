import { ErrorState } from "@/components/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { ApiRule } from "@/services/api/alerts";

import { useAlertDeliveries } from "../hooks/use-alert-deliveries";
import { useAlerts } from "../hooks/use-alerts";
import { AlertRow } from "./alert-row";

const SKELETON_KEYS = ["alert-skeleton-1", "alert-skeleton-2", "alert-skeleton-3"];

function AlertsSkeleton() {
  return (
    <div
      aria-busy="true"
      className="divide-y divide-border/40 overflow-hidden rounded-panel border border-border/40"
    >
      {SKELETON_KEYS.map((key) => (
        <div key={key} className="flex min-h-[3.5rem] items-center gap-4 px-panel py-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-[1.35em] w-2/5 type-data" />
            <Skeleton className="h-[1.2em] w-3/5 type-label" />
          </div>
          <Skeleton className="h-control w-16" />
          <Skeleton className="size-icon" />
        </div>
      ))}
    </div>
  );
}

function AlertList({ alerts }: { alerts: readonly ApiRule[] }) {
  const { data, isError } = useAlertDeliveries();

  const lastFiredByRule = new Map<string, string>();
  if (!isError) {
    for (const delivery of data?.deliveries ?? []) {
      if (!lastFiredByRule.has(delivery.ruleId)) {
        lastFiredByRule.set(delivery.ruleId, delivery.firedAt);
      }
    }
  }

  return (
    <ul
      aria-label="Alerts"
      className="divide-y divide-border/40 overflow-hidden rounded-panel border border-border/40"
    >
      {alerts.map((alert) => {
        const lastFiredAt = lastFiredByRule.get(alert.id);
        return (
          <AlertRow
            key={alert.id}
            alert={alert}
            {...(lastFiredAt === undefined ? {} : { lastFiredAt })}
          />
        );
      })}
    </ul>
  );
}

function AlertsEmpty() {
  return (
    <div className="overflow-hidden rounded-panel border border-border/40">
      <div className="flex flex-col gap-1 px-panel py-8">
        <p className="type-control text-foreground">No alerts yet.</p>
        <p className="type-label text-muted-foreground">
          Create one from a sentence or from the chart.
        </p>
      </div>
    </div>
  );
}

export function AlertsManager() {
  const { state, refetch } = useAlerts();

  const count = state.status === "ready" ? state.data.length : state.status === "empty" ? 0 : null;

  return (
    <section aria-labelledby="alerts-heading" className="flex flex-col">
      <div className="flex items-baseline justify-between gap-4">
        <h2
          id="alerts-heading"
          className="type-label font-medium tracking-wider text-muted-foreground uppercase"
        >
          Alerts
        </h2>
        {count === null ? null : (
          <span className="type-label tabular-nums text-muted-foreground">
            {count} {count === 1 ? "rule" : "rules"}
          </span>
        )}
      </div>
      <p className="mt-[0.5rem] type-label text-muted-foreground">
        Rules that fire when their condition matches.
      </p>

      <div className="mt-[0.75rem]">
        {state.status === "idle" || state.status === "loading" ? (
          <AlertsSkeleton />
        ) : state.status === "error" ? (
          <ErrorState
            title="Couldn't load alerts"
            description="Check your connection and try again."
            retryAction={() => {
              void refetch();
            }}
          />
        ) : state.status === "empty" ? (
          <AlertsEmpty />
        ) : (
          <AlertList alerts={state.data} />
        )}
      </div>
    </section>
  );
}
