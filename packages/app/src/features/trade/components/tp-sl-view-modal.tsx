import { Dialog, DialogContent, DialogTitle, DialogHeader } from "@/components/ui/dialog";
import { formatCompactUsd } from "@/core/utils/formatters";
import { type TpSlOrderDisplay } from "./tp-sl-view-utils";

/* ─── Internal types (not exported) ─── */

interface TpSlViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentOrder: TpSlOrderDisplay;
  tpOrder?: TpSlOrderDisplay;
  slOrder?: TpSlOrderDisplay;
}

/* ─── Helpers ─── */

function getSideLabel(side: "A" | "B"): string {
  return side === "B" ? "Long" : "Short";
}

function getSideColor(side: "A" | "B"): string {
  return side === "B" ? "text-gain" : "text-loss";
}

/* ─── Key-value row micro-component ─── */

function DetailRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between items-center py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={color ?? "text-foreground"}>{value}</span>
    </div>
  );
}

/* ─── Order detail box ─── */

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

/* ─── Decision-tree label ─── */

function TreeNodeLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-center text-muted-foreground mb-1.5">{children}</p>;
}

/* ─── Main Component ─── */

export function TpSlViewModal({
  open,
  onOpenChange,
  parentOrder,
  tpOrder,
  slOrder,
}: TpSlViewModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl bg-card border-border/30 p-0 gap-0 overflow-hidden">
        <div className="px-6 pt-5 pb-3 border-b border-border/20">
          <DialogHeader>
            <DialogTitle className="text-sm font-medium text-foreground">
              Take Profit / Stop Loss
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground/70 mt-1 leading-relaxed">
            If order A is filled, orders B and C will be placed
          </p>
        </div>

        <div className="px-6 py-5 space-y-0">
          <TreeNodeLabel>Order A</TreeNodeLabel>
          <div className="max-w-sm mx-auto">
            <OrderDetailBox order={parentOrder} />
          </div>

          <div className="h-8 w-px bg-border/40 mx-auto my-2" />

          {tpOrder || slOrder ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                {slOrder ? (
                  <>
                    <TreeNodeLabel>If order B filled, cancel order C</TreeNodeLabel>
                    <TreeNodeLabel>Order B</TreeNodeLabel>
                    <OrderDetailBox order={slOrder} />
                  </>
                ) : (
                  <div />
                )}
              </div>
              <div>
                {tpOrder ? (
                  <>
                    <TreeNodeLabel>If order C filled, cancel order B</TreeNodeLabel>
                    <TreeNodeLabel>Order C</TreeNodeLabel>
                    <OrderDetailBox order={tpOrder} />
                  </>
                ) : (
                  <div />
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-border/30 bg-background/40 px-3.5 py-3 mt-3">
              <p className="text-xs text-muted-foreground/60 text-center">
                No TP/SL orders attached
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
