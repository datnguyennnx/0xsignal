import { Button } from "@/components/ui/button";
import { QUOTE_ASSET } from "@/core/utils/hyperliquid";
import { formatAxis, formatCompactUsd } from "@/core/utils/formatters";

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
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between py-1">
          <span className="type-label text-muted-foreground">Order Value</span>
          <span className="type-label tabular-nums text-foreground">
            {orderValue > 0
              ? sizeAsset === QUOTE_ASSET
                ? formatCompactUsd(orderValue)
                : `${formatAxis(orderValue)} ${sizeAsset}`
              : "—"}
          </span>
        </div>
        <div className="flex items-center justify-between py-1">
          <span className="type-label text-muted-foreground">Margin Required</span>
          <span className="type-label tabular-nums text-foreground">
            {marginRequired > 0 ? formatCompactUsd(marginRequired) : "—"}
          </span>
        </div>
      </div>

      <Button
        variant="cta"
        onClick={onPlaceOrder}
        disabled={!canPlace || isPending}
        className="mt-0 w-full font-semibold uppercase tracking-wider transition-[background-color,scale] duration-(--dur-fast) ease-premium active:scale-[0.98]"
      >
        {isPending ? "Placing Order..." : "Place Order"}
      </Button>
    </>
  );
}
