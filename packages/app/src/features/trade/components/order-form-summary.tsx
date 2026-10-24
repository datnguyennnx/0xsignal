import { Button } from "@/components/ui/button";
import { formatCompactUsd } from "@/core/utils/formatters";

interface OrderFormSummaryProps {
  orderValue: number;
  marginRequired: number;
  sizeAsset: string;
  canPlace: boolean;
  isPending: boolean;
  onPlaceOrder: () => void;
}

export function OrderFormSummary({
  orderValue,
  marginRequired,
  sizeAsset,
  canPlace,
  isPending,
  onPlaceOrder,
}: OrderFormSummaryProps) {
  return (
    <>
      <div className="flex flex-col gap-[var(--space-1,0.3125rem)]">
        <div className="flex items-center justify-between py-[var(--space-1,0.3125rem)]">
          <span className="text-xs text-muted-foreground">Order Value</span>
          <span className="text-xs tabular-nums text-foreground">
            {orderValue > 0 ? `${formatCompactUsd(orderValue)} ${sizeAsset}` : "—"}
          </span>
        </div>
        <div className="flex items-center justify-between py-[var(--space-1,0.3125rem)]">
          <span className="text-xs text-muted-foreground">Margin Required</span>
          <span className="text-xs tabular-nums text-foreground">
            {marginRequired > 0 ? formatCompactUsd(marginRequired) : "—"}
          </span>
        </div>
        <div className="flex items-center justify-between py-[var(--space-1,0.3125rem)]">
          <span className="text-xs text-muted-foreground">Fees (Maker / Taker)</span>
          <span className="text-xs tabular-nums text-muted-foreground">0.0100% / 0.0350%</span>
        </div>
        <div className="flex items-center justify-between py-[var(--space-1,0.3125rem)]">
          <span className="text-xs text-muted-foreground">Liquidation Price</span>
          <span className="text-xs tabular-nums text-muted-foreground">N/A</span>
        </div>
      </div>

      <Button
        variant="default"
        onClick={onPlaceOrder}
        disabled={!canPlace || isPending}
        className="mt-[var(--space-2,0.75rem)] w-full h-[calc(var(--field-h,2.75rem)+0.5rem)] text-xs font-semibold uppercase tracking-wider rounded-lg border-0 transition-[background-color,scale] duration-150 ease-premium active:scale-[0.98]"
      >
        {isPending ? "Placing Order..." : "Place Order"}
      </Button>
    </>
  );
}
