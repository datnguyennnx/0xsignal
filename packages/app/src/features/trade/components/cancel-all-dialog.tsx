import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
      <DialogContent layout="dialog" className="gap-stack">
        <DialogHeader>
          <DialogTitle>Cancel All Orders</DialogTitle>
          <DialogDescription>
            Are you sure you want to cancel all {orderCount} open order
            {orderCount === 1 ? "" : "s"}?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="border-t-0 p-0">
          <DialogClose render={<Button variant="outline" className="font-medium" />}>
            Keep Orders
          </DialogClose>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isPending}
            className="font-medium"
          >
            Cancel All
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
