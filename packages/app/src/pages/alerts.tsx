import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AlertSheet } from "@/features/alerts/components/alert-sheet";
import { AlertsManager } from "@/features/alerts/components/alerts-manager";
import { DeliveryPanel } from "@/features/alerts/components/delivery-panel";
import {
  useAlertDeliveries,
  useMarkDeliveriesSeen,
} from "@/features/alerts/hooks/use-alert-deliveries";
import { queryKeys } from "@/lib/query-keys";

export function AlertsPage() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const queryClient = useQueryClient();
  const markSeen = useMarkDeliveriesSeen().mutate;
  const { state } = useAlertDeliveries();
  const unread = state.status === "ready" ? state.data.unread : 0;
  const seenRequested = useRef(false);

  useEffect(() => {
    if (unread === 0 || seenRequested.current) return;
    seenRequested.current = true;
    markSeen(undefined, {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.alerts.deliveries() });
      },
    });
  }, [unread, markSeen, queryClient]);

  return (
    <div className="mx-auto flex w-full max-w-[46rem] flex-col gap-[1.5rem] rounded-panel border bg-(--surface-raised) p-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-xl font-semibold tracking-tight text-balance">Alerts</h1>
          <Button
            variant="outline"
            onClick={() => {
              setSheetOpen(true);
            }}
          >
            <Plus aria-hidden="true" />
            New alert
          </Button>
        </div>
        <p className="type-data text-muted-foreground">
          In-app alerts, plus Telegram when connected.
        </p>
      </div>

      <DeliveryPanel />

      <AlertsManager />

      <AlertSheet open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  );
}
