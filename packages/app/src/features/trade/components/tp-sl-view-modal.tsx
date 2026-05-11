import { Dialog, DialogContent, DialogTitle, DialogHeader } from "@/components/ui/dialog";
import { formatPrice, formatCompactUsd } from "@/core/utils/formatters";
import type { OpenOrderSchema } from "@/services/api";
import { getOrderType, extractTriggerPx, resolveTriggerCondition } from "../utils/trigger-utils";

/* ─── Types ─── */

export interface TpSlOrderDisplay {
  label: string;
  type: string;
  side: "A" | "B";
  sz: string;
  trigger: string;
  price: string;
  isMarket?: boolean;
}

export interface TpSlViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The parent limit order */
  parentOrder: TpSlOrderDisplay;
  /** Optional take-profit child order */
  tpOrder?: TpSlOrderDisplay;
  /** Optional stop-loss child order */
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

/* ─── Order detail box (no header/title — just rows) ─── */

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
        {/* ─── Header ─── */}
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

        {/* ─── Body — decision tree layout ─── */}
        <div className="px-6 py-5 space-y-0">
          {/* ═══════ Order A (top) ═══════ */}
          <TreeNodeLabel>Order A</TreeNodeLabel>
          <div className="max-w-sm mx-auto">
            <OrderDetailBox order={parentOrder} />
          </div>

          {/* ═══════ Vertical connecting line ═══════ */}
          <div className="h-8 w-px bg-border/40 mx-auto my-2" />

          {/* ═══════ Orders B & C (side-by-side) ═══════ */}
          {tpOrder || slOrder ? (
            <div className="grid grid-cols-2 gap-4">
              {/* Column 1: Stop Loss (Order B) */}
              <div>
                {slOrder ? (
                  <>
                    <TreeNodeLabel>If order B filled, cancel order C</TreeNodeLabel>
                    <TreeNodeLabel>Order B</TreeNodeLabel>
                    <OrderDetailBox order={slOrder} />
                  </>
                ) : (
                  /* Empty placeholder to keep grid alignment when only TP exists */
                  <div />
                )}
              </div>

              {/* Column 2: Take Profit (Order C) */}
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
            /* Fallback when no children provided */
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

/* ─── Factory: build TpSlOrderDisplay from raw API order ─── */

export function toTpSlDisplay(order: OpenOrderSchema): TpSlOrderDisplay {
  const ot = getOrderType(order);
  const isTrigger = ot === "Stop Market" || ot === "Take Profit Market";
  const triggerPx = extractTriggerPx(order);

  // Build a clean modal trigger label — NOT using getTriggerLabel()
  // (getTriggerLabel prefixes "Price" which is redundant next to the "Trigger" row label)
  let triggerLabel = "N/A";
  if (isTrigger && triggerPx) {
    const condition = resolveTriggerCondition(order);
    const formattedPx = formatPrice(Number(triggerPx));
    triggerLabel = condition ? `${condition} ${formattedPx}` : `Trigger ${formattedPx}`;
  }

  const priceLabel = isTrigger ? "Market" : formatPrice(Number(order.limitPx));

  return {
    label: order.coin,
    type: ot,
    side: order.side,
    sz: order.sz,
    trigger: triggerLabel,
    price: priceLabel,
    isMarket: isTrigger,
  };
}
