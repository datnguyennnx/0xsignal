import type { ReactNode } from "react";
import { cn } from "cn";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
  MODAL_CONTENT_CLASS,
} from "@/components/ui/dialog";
import { formatCompactUsd } from "@/core/utils/formatters";
import { type TpSlOrderDisplay } from "../utils/tp-sl-view-utils";

interface TpSlViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentOrder: TpSlOrderDisplay;
  tpOrder?: TpSlOrderDisplay;
  slOrder?: TpSlOrderDisplay;
}

function getSideLabel(side: "A" | "B"): string {
  return side === "B" ? "Long" : "Short";
}

function getSideColor(side: "A" | "B"): string {
  return side === "B" ? "text-gain" : "text-loss";
}

function DetailRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between items-center py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={color ?? "text-foreground"}>{value}</span>
    </div>
  );
}

function OrderDetailBox({ order }: { order: TpSlOrderDisplay }) {
  return (
    <div className="border border-border/40 rounded-md p-3 space-y-0">
      <DetailRow label="Order Type" value={order.type} />
      <DetailRow label="Side" value={getSideLabel(order.side)} color={getSideColor(order.side)} />
      <DetailRow label="Amount" value={formatCompactUsd(Number(order.sz))} />
      <DetailRow label="Trigger" value={order.trigger} />
      <DetailRow label="Price" value={order.price} />
    </div>
  );
}

function TreeNodeLabel({ children }: { children: ReactNode }) {
  return <p className="text-xs text-center text-muted-foreground">{children}</p>;
}

export function TpSlViewModal({
  open,
  onOpenChange,
  parentOrder,
  tpOrder,
  slOrder,
}: TpSlViewModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(MODAL_CONTENT_CLASS, "sm:max-w-2xl p-0 gap-0")}>
        <DialogHeader className="px-6 pt-5 pb-3">
          <DialogTitle className="text-sm font-medium text-foreground">
            Take Profit / Stop Loss
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            If order A is filled, orders B and C will be placed
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-5 space-y-2">
          <TreeNodeLabel>Order A</TreeNodeLabel>
          <div className="max-w-sm mx-auto">
            <OrderDetailBox order={parentOrder} />
          </div>

          {tpOrder || slOrder ? (
            <div className="grid grid-cols-2 gap-[clamp(0.5rem,1vw,1rem)]">
              <div className="space-y-1.5">
                {slOrder ? (
                  <>
                    <TreeNodeLabel>If order B filled, cancel order C</TreeNodeLabel>
                    <TreeNodeLabel>Order B</TreeNodeLabel>
                    <OrderDetailBox order={slOrder} />
                  </>
                ) : null}
              </div>
              <div className="space-y-1.5">
                {tpOrder ? (
                  <>
                    <TreeNodeLabel>If order C filled, cancel order B</TreeNodeLabel>
                    <TreeNodeLabel>Order C</TreeNodeLabel>
                    <OrderDetailBox order={tpOrder} />
                  </>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-border/20 bg-muted/30 px-3 py-2">
              <p className="text-xs text-muted-foreground text-center">No TP/SL orders attached</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
