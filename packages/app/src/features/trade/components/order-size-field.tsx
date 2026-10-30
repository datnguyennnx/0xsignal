import type { ChangeEvent } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { formatOrderSize, MARGIN_BUFFER } from "../utils/trade-math";
import type { SizeAssetOption } from "./order-form-derivations";

interface OrderSizeFieldProps {
  size: string;
  onSizeChange: (size: string) => void;
  effectiveBalance: number;
  effectiveLeverage: number;
  usablePrice: number;
  szDecimals: number;
  normalizedSymbol: string;
  safeSizeAsset: string;
  sizeAssetOptions: SizeAssetOption[];
  onSizeAssetChange: (asset: string) => void;
}

// Derived from size so it cannot go stale when leverage or balance changes.
function deriveSliderPercent(size: string, maxNotional: number): number {
  if (!(maxNotional > 0) || !(Number(size) > 0)) return 0;
  return Math.min(100, Math.round((Number(size) / maxNotional) * 100));
}

function formatAssetQty(
  size: string,
  usablePrice: number,
  szDecimals: number,
  normalizedSymbol: string,
): string | null {
  if (!usablePrice || !Number(size)) return null;
  return `${formatOrderSize(Number(size) / usablePrice, szDecimals)} ${normalizedSymbol}`;
}

export function OrderSizeField({
  size,
  onSizeChange,
  effectiveBalance,
  effectiveLeverage,
  usablePrice,
  szDecimals,
  normalizedSymbol,
  safeSizeAsset,
  sizeAssetOptions,
  onSizeAssetChange,
}: OrderSizeFieldProps) {
  const maxNotional = effectiveBalance * effectiveLeverage * MARGIN_BUFFER;
  const sliderPercent = deriveSliderPercent(size, maxNotional);
  const assetQtyDisplay = formatAssetQty(size, usablePrice, szDecimals, normalizedSymbol);

  const applyPercent = (pct: number) => {
    if (effectiveBalance <= 0 || effectiveLeverage <= 0) {
      onSizeChange("0.00");
    } else {
      onSizeChange(((maxNotional * pct) / 100).toFixed(2));
    }
  };

  const handleSliderCommit = (value: number | readonly number[]) => {
    const pct = typeof value === "number" ? value : (value[0] ?? 0);
    applyPercent(pct);
  };

  const handlePctInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const pct = Math.min(100, Math.max(0, Number(raw) || 0));
    applyPercent(pct);
  };

  const handleSizeChange = (e: ChangeEvent<HTMLInputElement>) => {
    onSizeChange(e.target.value);
  };

  return (
    <>
      <div className="flex flex-col">
        <div className="flex items-center justify-between mb-[var(--space-1,0.3125rem)]">
          <Label
            htmlFor="order-form-size"
            className="text-xs uppercase tracking-wider text-muted-foreground font-normal"
          >
            Size ({safeSizeAsset})
          </Label>
          {sizeAssetOptions.length > 1 && (
            <NativeSelect
              size="sm"
              aria-label="Size asset"
              value={safeSizeAsset}
              onChange={(e) => {
                onSizeAssetChange(e.target.value);
              }}
              wrapperClassName="min-w-0"
              className="h-6 w-20 text-[length:var(--text-micro)] text-muted-foreground tabular-nums"
            >
              {sizeAssetOptions.map((opt) => (
                <NativeSelectOption key={opt.value} value={opt.value}>
                  {opt.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </div>
        <Input
          id="order-form-size"
          type="number"
          value={size}
          onChange={handleSizeChange}
          placeholder="0.00"
          className="h-[var(--field-h,2.75rem)] px-[var(--space-2,0.75rem)] w-full text-base sm:text-sm tabular-nums bg-background/80 border-border/40 hover:border-border/60 transition-colors"
        />
        {assetQtyDisplay !== null && (
          <p className="mt-[var(--space-1,0.3125rem)] text-[length:var(--text-micro)] text-muted-foreground tabular-nums text-right">
            → {assetQtyDisplay}
          </p>
        )}
      </div>

      <div className="flex items-center gap-[var(--space-2,0.75rem)]">
        <Slider
          value={[sliderPercent]}
          onValueChange={handleSliderCommit}
          min={0}
          max={100}
          step={1}
          aria-label="Order size"
          title="Order size"
          className="flex-1 [&_[data-slot=slider-thumb]]:hover:ring-4 [&_[data-slot=slider-thumb]]:hover:ring-ring/40 [&_[data-slot=slider-track]]:hover:bg-muted/40 [&_[data-slot=slider-range]]:hover:brightness-110"
        />
        <Input
          type="number"
          min={0}
          max={100}
          value={sliderPercent}
          onChange={handlePctInputChange}
          aria-label="Size percentage"
          className="w-16 h-[var(--field-h,2.75rem)] px-[var(--space-2,0.75rem)] text-base sm:text-sm text-center tabular-nums bg-background/80 border-border/40 shrink-0"
        />
        <span className="text-xs text-muted-foreground">%</span>
      </div>
    </>
  );
}
