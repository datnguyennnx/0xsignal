import { cn } from "cn";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ApiRule } from "@/services/api/alerts";

import { useDeleteAlert, useUpdateAlert } from "../hooks/use-alert-mutations";
import { describeDeliveryMeta } from "../lib/alert-format";

interface AlertRowProps {
  alert: ApiRule;
  lastFiredAt?: string;
}

export function AlertRow({ alert, lastFiredAt }: AlertRowProps) {
  const updateAlert = useUpdateAlert();
  const deleteAlert = useDeleteAlert();

  return (
    <li
      className={cn(
        "flex min-h-[3.5rem] items-center gap-4 px-panel py-3",
        "transition-opacity duration-(--duration-fast)",
        !alert.enabled && "opacity-60",
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="truncate type-control font-semibold tabular-nums text-foreground">
          {alert.summary}
        </p>
        <p className="truncate type-label tabular-nums text-muted-foreground">
          {describeDeliveryMeta(alert, lastFiredAt)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <label className="relative inline-flex shrink-0 cursor-pointer items-center has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
          <input
            type="checkbox"
            role="switch"
            aria-checked={alert.enabled}
            aria-label={`Enable alert ${alert.summary}`}
            checked={alert.enabled}
            disabled={updateAlert.isPending}
            className="peer sr-only"
            onChange={(event) => {
              updateAlert.mutate({ id: alert.id, enabled: event.target.checked });
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              updateAlert.mutate({ id: alert.id, enabled: !alert.enabled });
            }}
          />
          <span
            aria-hidden="true"
            className={cn(
              "focus-ring-peer flex h-[1.25rem] w-[2.25rem] items-center rounded-full border border-(--control-border) bg-muted p-[0.125rem]",
              "transition-colors duration-(--dur-fast) peer-checked:bg-primary",
            )}
          >
            <span
              className={cn(
                "size-[1rem] rounded-full bg-background shadow-(--shadow-e1) transition-transform duration-(--dur-fast)",
                alert.enabled && "translate-x-[1rem]",
              )}
            />
          </span>
        </label>
        <Button
          variant="ghost"
          size="icon"
          className="size-[2.25rem]"
          aria-label="Delete alert"
          disabled={deleteAlert.isPending}
          onClick={() => {
            deleteAlert.mutate(alert.id);
          }}
        >
          <Trash2 />
        </Button>
      </div>
    </li>
  );
}
