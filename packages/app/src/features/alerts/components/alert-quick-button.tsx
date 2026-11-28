import { Bell } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface AlertQuickButtonProps {
  count: number;
  onOpen: () => void;
}

export function AlertQuickButton({ count, onOpen }: AlertQuickButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="outline"
            aria-haspopup="dialog"
            aria-label={count > 0 ? `Alerts, ${count} active` : "Alerts"}
            className="min-h-(--hit-min) gap-1 transition-[scale,opacity] active:scale-[0.96]"
            onClick={onOpen}
          >
            <Bell className="size-icon" aria-hidden="true" />
            <span className="hidden sm:inline">Alerts</span>
            {count > 0 && <Badge className="min-w-[1rem] tabular-nums select-none">{count}</Badge>}
          </Button>
        }
      />
      <TooltipContent>Alerts</TooltipContent>
    </Tooltip>
  );
}
