import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
} from "@/components/ui/dialog";
import { formatCompactUsd } from "@/core/utils/formatters";
import { type TpSlOrderDisplay } from "../utils/tp-sl-view-utils";

interface TpSlViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentOrder: TpSlOrderDisplay;
  tpOrder?: TpSlOrderDisplay | undefined;
  slOrder?: TpSlOrderDisplay | undefined;
}

function getSideLabel(side: "A" | "B"): string {
  return side === "B" ? "Long" : "Short";
}

function getSideColor(side: "A" | "B"): string {
  return side === "B" ? "text-gain" : "text-loss";
}

function DetailRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between items-center py-1 type-data">
      <span className="text-muted-foreground">{label}</span>
      <span className={color ?? "text-foreground"}>{value}</span>
    </div>
  );
}

function OrderDetailBox({ order }: { order: TpSlOrderDisplay }) {
  return (
    <div className="border border-border/40 rounded-control p-2 space-y-1">
      <DetailRow label="Order Type" value={order.type} />
      <DetailRow label="Side" value={getSideLabel(order.side)} color={getSideColor(order.side)} />
      <DetailRow label="Amount" value={formatCompactUsd(Number(order.sz))} />
      <DetailRow label="Trigger" value={order.trigger} />
      <DetailRow label="Price" value={order.price} />
    </div>
  );
}

function TreeNodeLabel({ children }: { children: ReactNode }) {
  return <p className="type-label text-center text-muted-foreground">{children}</p>;
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
      <DialogContent layout="dialog" className="sm:max-w-2xl gap-stack">
        <DialogHeader>
          <DialogTitle>Take Profit / Stop Loss</DialogTitle>
          <DialogDescription className="type-label leading-relaxed">
            If order A is filled, orders B and C will be placed
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <TreeNodeLabel>Order A</TreeNodeLabel>
          <div className="max-w-sm mx-auto">
            <OrderDetailBox order={parentOrder} />
          </div>

          {tpOrder || slOrder ? (
            <div className="grid grid-cols-2 gap-inline">
              <div className="space-y-1">
                {slOrder ? (
                  <>
                    <TreeNodeLabel>If order B filled, cancel order C</TreeNodeLabel>
                    <TreeNodeLabel>Order B</TreeNodeLabel>
                    <OrderDetailBox order={slOrder} />
                  </>
                ) : null}
              </div>
              <div className="space-y-1">
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
            <div className="rounded-control border border-border/25 bg-muted/40 px-2 py-1">
              <p className="type-label text-muted-foreground text-center">
                No TP/SL orders attached
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
