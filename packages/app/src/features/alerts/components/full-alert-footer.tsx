import { Button } from "@/components/ui/button";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";

interface FullAlertFooterProps {
  canArm: boolean;
  isPending: boolean;
  onArm: () => void;
}

export function FullAlertFooter({ canArm, isPending, onArm }: FullAlertFooterProps) {
  return (
    <DialogFooter>
      <DialogClose render={<Button variant="secondary" className="h-control!" />}>
        Cancel
      </DialogClose>
      <Button
        variant="accent"
        className="h-control!"
        disabled={!canArm || isPending}
        onClick={onArm}
      >
        {isPending ? "Arming…" : "Arm alert"}
      </Button>
    </DialogFooter>
  );
}
