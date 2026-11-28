import { Link } from "react-router";
import { Bell } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { useAlertDeliveries } from "../hooks/use-alert-deliveries";

export function AlertBell() {
  const { state } = useAlertDeliveries();
  const unread = state.status === "ready" ? state.data.unread : 0;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="outline"
              size="icon"
              data-dense
              className="relative"
              render={<Link to="/alerts" />}
            />
          }
        >
          <Bell className="size-icon" aria-hidden="true" />
          <span className="sr-only">Alerts</span>
          {unread > 0 && (
            <Badge
              aria-hidden="true"
              className="pointer-events-none absolute -top-1 -right-1 min-w-4 tabular-nums select-none"
            >
              {unread > 99 ? "99+" : unread}
            </Badge>
          )}
        </TooltipTrigger>
        <TooltipContent>Alerts</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
