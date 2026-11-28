import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";

interface QuickAlertFooterProps {
  canArm: boolean;
  isPending: boolean;
  limitReached: boolean;
  onArm: () => void;
  onShowFull: () => void;
}

export function QuickAlertFooter({
  canArm,
  isPending,
  limitReached,
  onArm,
  onShowFull,
}: QuickAlertFooterProps) {
  return (
    <DialogFooter>
      <Button variant="ghost" className="h-control! sm:mr-auto" onClick={onShowFull}>
        More options
      </Button>
      <Button
        variant="accent"
        className="h-control!"
        disabled={!canArm || isPending || limitReached}
        onClick={onArm}
      >
        {isPending ? "Arming…" : limitReached ? "Limit reached" : "Arm alert"}
      </Button>
    </DialogFooter>
  );
}

Object.assign(QuickAlertFooter, { __dialogSlot: "footer" as const });
