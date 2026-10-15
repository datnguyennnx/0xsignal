import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  MODAL_CONTENT_CLASS,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "cn";

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
      <DialogContent
        className={cn(
          MODAL_CONTENT_CLASS,
          "sm:max-w-[clamp(18rem,36vw,22.5rem)] p-5 gap-[clamp(0.75rem,1.25vw,1.25rem)]",
        )}
      >
        <DialogHeader>
          <DialogTitle className="text-sm font-medium text-foreground">
            Cancel All Orders
          </DialogTitle>
          <DialogDescription className="text-[length:var(--text-compact)] leading-relaxed">
            Are you sure you want to cancel all {orderCount} open order
            {orderCount !== 1 ? "s" : ""}?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mx-0 mb-0 flex-row items-center justify-end gap-[clamp(0.5rem,0.8vw,0.75rem)] rounded-none border-t-0 bg-transparent p-0">
          <DialogClose
            render={
              <Button
                variant="outline"
                className="h-10 px-3 text-[length:var(--text-compact)] font-medium"
              />
            }
          >
            Keep Orders
          </DialogClose>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isPending}
            className="h-10 px-3 text-[length:var(--text-compact)] font-medium"
          >
            Cancel All
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
