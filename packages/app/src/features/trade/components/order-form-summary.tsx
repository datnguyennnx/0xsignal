import { Button } from "@/components/ui/button";
import { QUOTE_ASSET } from "@/core/utils/hyperliquid";
import { formatAxis, formatCompactUsd } from "@/core/utils/formatters";
import { FieldRow } from "./shared-table-components";

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
        <FieldRow
          label="Order Value"
          value={
            orderValue > 0
              ? sizeAsset === QUOTE_ASSET
                ? formatCompactUsd(orderValue)
                : `${formatAxis(orderValue)} ${sizeAsset}`
              : "—"
          }
        />
        <FieldRow
          label="Margin Required"
          value={marginRequired > 0 ? formatCompactUsd(marginRequired) : "—"}
        />
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
