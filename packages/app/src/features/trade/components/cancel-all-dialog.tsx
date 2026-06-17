import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface CancelAllDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderCount: number;
  onConfirm: () => void;
  isPending?: boolean;
}

/**
 * Confirmation dialog for cancelling all open orders.
 * Extracted from position-management.tsx for separation of concerns.
 */
export function CancelAllDialog({
  open,
  onOpenChange,
  orderCount,
  onConfirm,
  isPending = false,
}: CancelAllDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[360px] bg-card border-border/30 p-5 gap-[clamp(0.75rem,1.25vw,1.25rem)] overflow-hidden">
        <div className="p-0">
          <DialogHeader>
            <DialogTitle className="text-sm font-medium text-foreground">
              Cancel All Orders
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground/70 leading-relaxed">
            Are you sure you want to cancel all {orderCount} open order
            {orderCount !== 1 ? "s" : ""}?
          </p>
        </div>
        <div className="flex items-center justify-end gap-[clamp(0.5rem,0.8vw,0.75rem)] p-0">
          <DialogClose asChild>
            <Button variant="outline" className="h-8 px-3 text-xs font-medium">
              Keep Orders
            </Button>
          </DialogClose>
          <Button
            onClick={onConfirm}
            disabled={isPending}
            className="h-8 px-3 text-xs font-medium bg-foreground text-background hover:bg-foreground/90"
          >
            Cancel All
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
